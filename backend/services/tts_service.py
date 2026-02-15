"""ElevenLabs 스트리밍 TTS 서비스"""

import logging
from typing import AsyncGenerator, Optional

from elevenlabs import AsyncElevenLabs, VoiceSettings
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

        if not self.voice_id:
            logger.warning("[TTS] Voice ID 미설정 → 스트리밍 스킵")
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

            voice_settings = VoiceSettings(
                stability=stability,
                similarity_boost=0.75,
                style=style,
                use_speaker_boost=True,
            )

            logger.info(f"[TTS] 요청: voice={self.voice_id}, text_len={len(tagged_text)}")

            # convert_as_stream → async iterator 반환
            try:
                audio_response = await self.client.text_to_speech.convert_as_stream(
                    voice_id=self.voice_id,
                    text=tagged_text,
                    model_id=self.model_id,
                    voice_settings=voice_settings,
                    output_format="pcm_16000",
                )
            except AttributeError:
                # SDK 버전에 따라 convert_as_stream이 없을 수 있음
                logger.info("[TTS] convert_as_stream 없음, convert 사용")
                audio_response = await self.client.text_to_speech.convert(
                    voice_id=self.voice_id,
                    text=tagged_text,
                    model_id=self.model_id,
                    voice_settings=voice_settings,
                    output_format="pcm_16000",
                )

            # 반환값이 bytes인 경우 (비스트리밍)
            if isinstance(audio_response, bytes):
                logger.info(f"[TTS] bytes 반환: {len(audio_response)} bytes")
                for i in range(0, len(audio_response), chunk_size):
                    yield audio_response[i : i + chunk_size]
                return

            # async iterator인 경우
            chunk_count = 0
            async for chunk in audio_response:
                if chunk:
                    chunk_count += 1
                    yield chunk
            logger.info(f"[TTS] 스트리밍 완료: {chunk_count} chunks")

        except ApiError as e:
            logger.error(f"ElevenLabs API 오류: status={e.status_code}, body={e.body}")
        except Exception as e:
            logger.error(f"TTS 합성 오류: {type(e).__name__}: {e}")
