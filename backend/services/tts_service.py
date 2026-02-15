"""ElevenLabs 스트리밍 TTS 서비스"""

import logging
from typing import AsyncGenerator, Optional

from elevenlabs import AsyncElevenLabs
from elevenlabs.core import ApiError

from backend.config import settings
from backend.models.schemas import EmotionMapping
from backend.services.emotion_mapper import apply_audio_tag

logger = logging.getLogger(__name__)


class ElevenLabsTTSService:
    """ElevenLabs API 기반 실시간 TTS 서비스"""

    def __init__(self):
        self.client = AsyncElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        self.voice_id = settings.ELEVENLABS_VOICE_ID
        self.model_id = "eleven_multilingual_v2"  # 다국어 지원 모델

    def _is_api_key_valid(self) -> bool:
        """API 키가 유효한지 확인합니다."""
        key = settings.ELEVENLABS_API_KEY
        return bool(key) and not key.startswith("your_") and len(key) > 10

    async def synthesize_speech_streaming(
        self,
        text: str,
        emotion_mapping: Optional[EmotionMapping] = None,
        chunk_size: int = 4096,
    ) -> AsyncGenerator[bytes, None]:
        """
        텍스트를 음성으로 변환하여 청크 단위로 스트리밍합니다.
        """
        if not self._is_api_key_valid():
            logger.warning("[TTS] API 키 미설정 → 스트리밍 스킵")
            return

        try:
            # 감정 Audio Tag 적용
            if emotion_mapping and emotion_mapping.elevenlabs_audio_tag:
                tagged_text = apply_audio_tag(
                    text, emotion_mapping.elevenlabs_audio_tag
                )
            else:
                tagged_text = text

            stability = 0.5
            style = 0.0
            if emotion_mapping:
                stability = emotion_mapping.voice_stability
                style = emotion_mapping.voice_style

            audio_response = await self.client.text_to_speech.convert(
                voice_id=self.voice_id,
                text=tagged_text,
                model_id=self.model_id,
                voice_settings={
                    "stability": stability,
                    "similarity_boost": 0.75,
                    "style": style,
                    "use_speaker_boost": True,
                },
                output_format="pcm_16000",
            )

            async for chunk in audio_response:
                if chunk:
                    yield chunk

        except ApiError as e:
            logger.error(f"ElevenLabs 스트리밍 오류: {e}")
        except Exception as e:
            logger.error(f"TTS 스트리밍 합성 오류: {e}")

