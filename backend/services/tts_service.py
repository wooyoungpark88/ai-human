"""ElevenLabs 스트리밍 TTS 서비스 (httpx 직접 호출)"""

import logging
from typing import AsyncGenerator, Optional

import httpx

from backend.config import settings
from backend.models.schemas import EmotionMapping
from backend.services.emotion_mapper import build_tagged_text

logger = logging.getLogger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


class ElevenLabsTTSService:
    """ElevenLabs REST API 직접 호출 기반 실시간 TTS 서비스"""

    def __init__(self):
        self.voice_id = settings.ELEVENLABS_VOICE_ID
        self.api_key = settings.ELEVENLABS_API_KEY
        self.model_id = settings.ELEVENLABS_MODEL_ID

    def _is_api_key_valid(self) -> bool:
        """API 키가 유효한지 확인합니다."""
        key = self.api_key
        return bool(key) and not key.startswith("your_") and len(key) > 10

    async def synthesize_speech_streaming(
        self,
        text: str,
        emotion_mapping: Optional[EmotionMapping] = None,
        voice_direction: str = "",
        chunk_size: int = 4096,
    ) -> AsyncGenerator[bytes, None]:
        """
        텍스트를 음성으로 변환하여 청크 단위로 스트리밍합니다.
        httpx를 사용하여 ElevenLabs REST API를 직접 호출합니다.
        """
        if not self._is_api_key_valid():
            logger.warning("[TTS] API 키 미설정 → 스트리밍 스킵")
            return

        if not self.voice_id:
            logger.warning("[TTS] Voice ID 미설정 → 스트리밍 스킵")
            return

        try:
            # 감정 Audio Tag + voice_direction 적용
            if emotion_mapping:
                tagged_text = build_tagged_text(
                    text,
                    emotion_mapping.elevenlabs_audio_tag,
                    voice_direction,
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

            url = (
                f"{ELEVENLABS_BASE_URL}/text-to-speech/"
                f"{self.voice_id}/stream?output_format=pcm_16000"
            )
            headers = {
                "xi-api-key": self.api_key,
                "Content-Type": "application/json",
            }
            payload = {
                "text": tagged_text,
                "model_id": self.model_id,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": 0.75,
                    "style": style,
                    "use_speaker_boost": True,
                    "speed": speed,
                },
            }

            logger.info(
                f"[TTS] 요청: voice={self.voice_id}, "
                f"model={self.model_id}, speed={speed}, "
                f"text_len={len(tagged_text)}, "
                f"text_preview={tagged_text[:80]!r}"
            )

            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST", url, json=payload, headers=headers
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        logger.error(
                            f"[TTS] API 오류: status={response.status_code}, "
                            f"body={body.decode('utf-8', errors='replace')}"
                        )
                        return

                    chunk_count = 0
                    async for chunk in response.aiter_bytes(chunk_size):
                        if chunk:
                            chunk_count += 1
                            yield chunk

                    logger.info(f"[TTS] 스트리밍 완료: {chunk_count} chunks")

        except httpx.HTTPStatusError as e:
            logger.error(
                f"[TTS] HTTP 오류: status={e.response.status_code}, "
                f"body={e.response.text}"
            )
        except Exception as e:
            logger.error(f"[TTS] 합성 오류: {type(e).__name__}: {e}")
