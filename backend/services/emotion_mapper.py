"""감정 -> Simli emotion_id / ElevenLabs Audio Tag 매핑"""

from backend.models.schemas import EmotionType, EmotionMapping

# 감정 매핑 테이블 (아키텍처 문서 기반)
EMOTION_MAP: dict[EmotionType, EmotionMapping] = {
    EmotionType.NEUTRAL: EmotionMapping(
        simli_emotion_id="neutral",
        elevenlabs_audio_tag="",
        voice_stability=0.5,
        voice_style=0.0,
    ),
    EmotionType.HAPPY: EmotionMapping(
        simli_emotion_id="happy",
        elevenlabs_audio_tag="[cheerfully]",
        voice_stability=0.4,
        voice_style=0.6,
    ),
    EmotionType.SAD: EmotionMapping(
        simli_emotion_id="sad",
        elevenlabs_audio_tag="[sorrowful]",
        voice_stability=0.3,
        voice_style=0.5,
    ),
    EmotionType.ANGRY: EmotionMapping(
        simli_emotion_id="angry",
        elevenlabs_audio_tag="[frustrated]",
        voice_stability=0.35,
        voice_style=0.7,
    ),
    EmotionType.SURPRISED: EmotionMapping(
        simli_emotion_id="surprised",
        elevenlabs_audio_tag="[gasps]",
        voice_stability=0.3,
        voice_style=0.6,
    ),
    EmotionType.THINKING: EmotionMapping(
        simli_emotion_id="thinking",
        elevenlabs_audio_tag="[pauses]",
        voice_stability=0.6,
        voice_style=0.2,
    ),
    EmotionType.ANXIOUS: EmotionMapping(
        simli_emotion_id="anxious",
        elevenlabs_audio_tag="[nervously]",
        voice_stability=0.3,
        voice_style=0.5,
    ),
    EmotionType.EMPATHETIC: EmotionMapping(
        simli_emotion_id="empathetic",
        elevenlabs_audio_tag="[calm]",
        voice_stability=0.4,
        voice_style=0.4,
    ),
}


def get_emotion_mapping(emotion: EmotionType, intensity: float = 0.5) -> EmotionMapping:
    """
    감정 타입과 강도에 따라 매핑 결과를 반환합니다.
    intensity에 따라 voice_stability를 동적으로 조절합니다.
    """
    mapping = EMOTION_MAP.get(emotion, EMOTION_MAP[EmotionType.NEUTRAL])

    # intensity가 높을수록 stability를 낮추어 감정 표현을 풍부하게
    adjusted_stability = max(0.1, mapping.voice_stability - (intensity * 0.2))
    adjusted_style = min(1.0, mapping.voice_style + (intensity * 0.2))

    return EmotionMapping(
        simli_emotion_id=mapping.simli_emotion_id,
        elevenlabs_audio_tag=mapping.elevenlabs_audio_tag,
        voice_stability=adjusted_stability,
        voice_style=adjusted_style,
    )


def apply_audio_tag(text: str, audio_tag: str) -> str:
    """텍스트 앞에 ElevenLabs Audio Tag를 삽입합니다."""
    if audio_tag:
        return f"{audio_tag} {text}"
    return text
