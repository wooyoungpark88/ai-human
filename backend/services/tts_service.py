"""ElevenLabs TTS 서비스 — WebSocket 스트리밍 (레이턴시 최적화)

HTTP REST 대비 WebSocket의 장점:
- 지속 연결로 HTTP handshake 오버헤드 제거 (~200ms 절감)
- 입력 스트리밍: 텍스트를 받는 즉시 TTS에 전달
- flush 명령으로 즉시 오디오 생성
"""

import asyncio
import base64
import json
import logging
from typing import AsyncGenerator, Optional

import httpx
import websockets

from backend.config import settings
from backend.models.schemas import EmotionMapping
from backend.services.emotion_mapper import build_tagged_text

logger = logging.getLogger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"
ELEVENLABS_WS_URL = "wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id={model_id}&output_format=pcm_16000"


class ElevenLabsTTSService:
    """ElevenLabs WebSocket 기반 실시간 TTS 서비스 (HTTP fallback 포함)"""

    def __init__(self):
        self.voice_id = settings.ELEVENLABS_VOICE_ID
        self.api_key = settings.ELEVENLABS_API_KEY
        self.model_id = settings.ELEVENLABS_MODEL_ID

    def _is_api_key_valid(self) -> bool:
        """API 키가 유효한지 확인합니다."""
        key = self.api_key
        return bool(key) and not key.startswith("your_") and len(key) > 10

    def _supports_audio_tags(self) -> bool:
        """Audio tags는 eleven_v3 계열 모델에서만 지원됩니다."""
        return self.model_id.startswith("eleven_v3")

    async def synthesize_speech_streaming(
        self,
        text: str,
        emotion_mapping: Optional[EmotionMapping] = None,
        voice_direction: str = "",
        chunk_size: int = 4096,
    ) -> AsyncGenerator[bytes, None]:
        """텍스트를 음성으로 변환하여 청크 단위로 스트리밍합니다.

        WebSocket을 우선 시도하고, 실패 시 HTTP로 fallback합니다.
        """
        if not self._is_api_key_valid():
            logger.warning("[TTS] API 키 미설정 → 스트리밍 스킵")
            return

        if not self.voice_id:
            logger.warning("[TTS] Voice ID 미설정 → 스트리밍 스킵")
            return

        # 감정 태그 적용 (v3 모델만 audio tag 지원, flash 모델은 태그를 텍스트로 읽어버림)
        if emotion_mapping and self._supports_audio_tags():
            tagged_text = build_tagged_text(
                text, emotion_mapping.elevenlabs_audio_tag, voice_direction
            )
        else:
            tagged_text = text

        stability = 0.5
        style = 0.0
        speed = 1.0
        if emotion_mapping:
            stability = emotion_mapping.voice_stability
            style = emotion_mapping.voice_style
            speed = emotion_mapping.voice_speed

        logger.info(
            f"[TTS] 요청: voice={self.voice_id}, model={self.model_id}, "
            f"speed={speed}, text_len={len(tagged_text)}, "
            f"text_preview={tagged_text[:80]!r}"
        )

        # WebSocket TTS 시도
        try:
            async for chunk in self._synthesize_ws(
                tagged_text, stability, style, speed
            ):
                yield chunk
            return
        except Exception as e:
            logger.warning(f"[TTS] WebSocket 실패, HTTP fallback: {type(e).__name__}: {e}")

        # HTTP fallback
        async for chunk in self._synthesize_http(
            tagged_text, stability, style, speed, chunk_size
        ):
            yield chunk

    async def _synthesize_ws(
        self,
        text: str,
        stability: float,
        style: float,
        speed: float,
    ) -> AsyncGenerator[bytes, None]:
        """WebSocket을 사용한 TTS 스트리밍 (낮은 레이턴시)."""
        ws_url = ELEVENLABS_WS_URL.format(
            voice_id=self.voice_id, model_id=self.model_id
        )

        async with websockets.connect(
            ws_url,
            additional_headers={"xi-api-key": self.api_key},
        ) as ws:
            # BOS (Beginning of Stream) 메시지
            bos_message = {
                "text": " ",
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": 0.75,
                    "style": style,
                    "use_speaker_boost": True,
                    "speed": speed,
                },
                "generation_config": {
                    "flush": True,
                },
            }
            await ws.send(json.dumps(bos_message))

            # 텍스트 전송 + flush
            text_message = {
                "text": text,
                "flush": True,
            }
            await ws.send(json.dumps(text_message))

            # EOS (End of Stream) 메시지
            eos_message = {"text": ""}
            await ws.send(json.dumps(eos_message))

            # 오디오 청크 수신
            chunk_count = 0
            async for msg in ws:
                try:
                    data = json.loads(msg)
                    if data.get("audio"):
                        audio_bytes = base64.b64decode(data["audio"])
                        chunk_count += 1
                        yield audio_bytes
                    if data.get("isFinal"):
                        break
                except (json.JSONDecodeError, KeyError):
                    continue

            logger.info(f"[TTS] WebSocket 스트리밍 완료: {chunk_count} chunks")

    async def _synthesize_http(
        self,
        text: str,
        stability: float,
        style: float,
        speed: float,
        chunk_size: int = 4096,
    ) -> AsyncGenerator[bytes, None]:
        """HTTP REST API를 사용한 TTS 스트리밍 (fallback)."""
        url = (
            f"{ELEVENLABS_BASE_URL}/text-to-speech/"
            f"{self.voice_id}/stream?output_format=pcm_16000"
        )
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": 0.75,
                "style": style,
                "use_speaker_boost": True,
                "speed": speed,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST", url, json=payload, headers=headers
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        logger.error(
                            f"[TTS] HTTP API 오류: status={response.status_code}, "
                            f"body={body.decode('utf-8', errors='replace')}"
                        )
                        return

                    chunk_count = 0
                    async for chunk in response.aiter_bytes(chunk_size):
                        if chunk:
                            chunk_count += 1
                            yield chunk

                    logger.info(f"[TTS] HTTP 스트리밍 완료: {chunk_count} chunks")

        except httpx.HTTPStatusError as e:
            logger.error(
                f"[TTS] HTTP 오류: status={e.response.status_code}, "
                f"body={e.response.text}"
            )
        except Exception as e:
            logger.error(f"[TTS] HTTP 합성 오류: {type(e).__name__}: {e}")
