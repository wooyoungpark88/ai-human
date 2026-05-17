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
from backend.utils import validate_api_key

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
        return validate_api_key(self.api_key)

    def _supports_audio_tags(self) -> bool:
        """Audio tags는 eleven_v3 계열 모델에서만 지원됩니다."""
        return self.model_id.startswith("eleven_v3")

    async def synthesize_speech_streaming(
        self,
        text: str,
        emotion_mapping: Optional[EmotionMapping] = None,
        voice_direction: str = "",
        chunk_size: int = 2560,  # 80ms @ 16kHz/16bit mono — WS 페이싱과 일치
        voice_id: Optional[str] = None,
    ) -> AsyncGenerator[bytes, None]:
        """텍스트를 음성으로 변환하여 청크 단위로 스트리밍합니다.

        voice_id가 명시되면 해당 voice 사용 (케이스별 voice 분기).
        없으면 글로벌 settings.ELEVENLABS_VOICE_ID 폴백.
        WebSocket을 우선 시도하고, 실패 시 HTTP로 fallback합니다.
        """
        if not self._is_api_key_valid():
            logger.warning("[TTS] API 키 미설정 → 스트리밍 스킵")
            return

        effective_voice = voice_id or self.voice_id
        if not effective_voice:
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
            f"[TTS] 요청: voice={effective_voice}, model={self.model_id}, "
            f"speed={speed}, text_len={len(tagged_text)}, "
            f"text_preview={tagged_text[:80]!r}"
        )

        # WebSocket TTS 시도
        try:
            async for chunk in self._synthesize_ws(
                tagged_text, stability, style, speed, voice_id=effective_voice
            ):
                yield chunk
            return
        except Exception as e:
            logger.warning(f"[TTS] WebSocket 실패, HTTP fallback: {type(e).__name__}: {e}")

        # HTTP fallback
        async for chunk in self._synthesize_http(
            tagged_text, stability, style, speed, chunk_size, voice_id=effective_voice
        ):
            yield chunk

    async def _synthesize_ws(
        self,
        text: str,
        stability: float,
        style: float,
        speed: float,
        voice_id: Optional[str] = None,
    ) -> AsyncGenerator[bytes, None]:
        """WebSocket을 사용한 TTS 스트리밍 (낮은 레이턴시)."""
        ws_url = ELEVENLABS_WS_URL.format(
            voice_id=voice_id or self.voice_id, model_id=self.model_id
        )

        async with websockets.connect(
            ws_url,
            additional_headers={"xi-api-key": self.api_key},
        ) as ws:
            # 단일 메시지로 voice_settings + 전체 텍스트 + flush 동시 전송
            # (이전엔 BOS 공백 → text → EOS 3개로 보냈는데, 합치면 핸드셰이크
            # 한 라운드 절약돼 첫 청크 ~50ms 빨라짐)
            payload = {
                "text": text,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": 0.75,
                    "style": style,
                    "use_speaker_boost": True,
                    "speed": speed,
                },
                "generation_config": {"flush": True},
                "flush": True,
            }
            await ws.send(json.dumps(payload))

            # EOS (End of Stream)
            await ws.send(json.dumps({"text": ""}))

            # 오디오 청크 수신 + 페이싱 정규화
            # ElevenLabs는 가변 크기 청크를 burst로 보냄 (2KB~32KB) — 그대로 흘리면
            # Simli SDK의 AudioWorklet 큐 페이싱이 출렁여 stutter 발생.
            # PCM16 mono 16kHz 기준 80ms = 2560 bytes 단위로 재패키징해
            # WS 메시지 빈도를 ~12.5회/초로 평탄화.
            PACED_CHUNK_BYTES = 2560  # 80ms @ 16kHz/16bit mono
            buffer = bytearray()
            chunk_count = 0
            async for msg in ws:
                try:
                    data = json.loads(msg)
                    if data.get("audio"):
                        buffer.extend(base64.b64decode(data["audio"]))
                        while len(buffer) >= PACED_CHUNK_BYTES:
                            yield bytes(buffer[:PACED_CHUNK_BYTES])
                            del buffer[:PACED_CHUNK_BYTES]
                            chunk_count += 1
                    if data.get("isFinal"):
                        break
                except (json.JSONDecodeError, KeyError):
                    continue

            # 잔여 버퍼 flush (마지막 청크는 < 80ms일 수 있으나 끝 단어 잘림 방지 위해 그대로 송신)
            if buffer:
                yield bytes(buffer)
                chunk_count += 1

            logger.info(f"[TTS] WebSocket 스트리밍 완료: {chunk_count} chunks (80ms 페이싱)")

    async def _synthesize_http(
        self,
        text: str,
        stability: float,
        style: float,
        speed: float,
        chunk_size: int = 2560,  # WS 페이싱과 일치 (80ms @ 16kHz/16bit mono)
        voice_id: Optional[str] = None,
    ) -> AsyncGenerator[bytes, None]:
        """HTTP REST API를 사용한 TTS 스트리밍 (fallback)."""
        url = (
            f"{ELEVENLABS_BASE_URL}/text-to-speech/"
            f"{voice_id or self.voice_id}/stream?output_format=pcm_16000"
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
