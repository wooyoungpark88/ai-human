"""감정 -> Simli emotion_id / ElevenLabs Audio Tag 매핑"""

from backend.models.schemas import EmotionType, EmotionMapping

# 감정 매핑 테이블 (아키텍처 문서 기반)
EMOTION_MAP: dict[EmotionType, EmotionMapping] = {
    EmotionType.NEUTRAL: EmotionMapping(
        simli_emotion_id="neutral",
        elevenlabs_audio_tag="",
        voice_stability=0.5,
        voice_style=0.0,
        voice_speed=0.9,
    ),
    EmotionType.HAPPY: EmotionMapping(
        simli_emotion_id="happy",
        elevenlabs_audio_tag="[cheerfully]",
        voice_stability=0.4,
        voice_style=0.6,
        voice_speed=0.95,
    ),
    EmotionType.SAD: EmotionMapping(
        simli_emotion_id="sad",
        elevenlabs_audio_tag="[sorrowful]",
        voice_stability=0.3,
        voice_style=0.5,
        voice_speed=0.78,
    ),
    EmotionType.ANGRY: EmotionMapping(
        simli_emotion_id="angry",
        elevenlabs_audio_tag="[frustrated]",
        voice_stability=0.35,
        voice_style=0.7,
        voice_speed=0.95,
    ),
    EmotionType.SURPRISED: EmotionMapping(
        simli_emotion_id="surprised",
        elevenlabs_audio_tag="[gasps]",
        voice_stability=0.3,
        voice_style=0.6,
        voice_speed=0.95,
    ),
    EmotionType.THINKING: EmotionMapping(
        simli_emotion_id="thinking",
        elevenlabs_audio_tag="[pauses]",
        voice_stability=0.6,
        voice_style=0.2,
        voice_speed=0.82,
    ),
    EmotionType.ANXIOUS: EmotionMapping(
        simli_emotion_id="anxious",
        elevenlabs_audio_tag="[nervously]",
        voice_stability=0.3,
        voice_style=0.5,
        voice_speed=0.92,
    ),
    EmotionType.EMPATHETIC: EmotionMapping(
        simli_emotion_id="empathetic",
        elevenlabs_audio_tag="[calm]",
        voice_stability=0.4,
        voice_style=0.4,
        voice_speed=0.85,
    ),
}

# 한국어 voice_direction → 영어 ElevenLabs 오디오 태그 매핑
VOICE_DIRECTION_TAG_MAP: dict[str, str] = {
    "조용히": "[quietly]",
    "울먹이며": "[tearfully]",
    "밝게": "[cheerfully]",
    "차분하게": "[calm]",
    "힘차게": "[energetically]",
    "부드럽게": "[softly]",
    "따뜻하게": "[warmly]",
    "단호하게": "[firmly]",
    "긴장하며": "[nervously]",
    "놀라며": "[gasps]",
    "생각하며": "[thoughtfully]",
    "걱정하며": "[worriedly]",
    "슬프게": "[sorrowful]",
    "화나며": "[frustrated]",
    "기쁘게": "[cheerfully]",
    "설레며": "[excited]",
}


def round_to_valid_stability(value: float) -> float:
    """
    ElevenLabs API가 허용하는 stability 값(0.0, 0.5, 1.0)으로 반올림합니다.
    
    Args:
        value: 계산된 stability 값
        
    Returns:
        0.0, 0.5, 1.0 중 하나
    """
    if value < 0.25:
        return 0.0
    elif value < 0.75:
        return 0.5
    else:
        return 1.0


def get_emotion_mapping(emotion: EmotionType, intensity: float = 0.5) -> EmotionMapping:
    """
    감정 타입과 강도에 따라 매핑 결과를 반환합니다.
    intensity에 따라 voice_stability, voice_style, voice_speed를 동적으로 조절합니다.
    """
    mapping = EMOTION_MAP.get(emotion, EMOTION_MAP[EmotionType.NEUTRAL])

    # intensity가 높을수록 stability를 낮추어 감정 표현을 풍부하게
    raw_stability = mapping.voice_stability - (intensity * 0.2)
    adjusted_stability = round_to_valid_stability(raw_stability)
    adjusted_style = min(1.0, mapping.voice_style + (intensity * 0.2))

    # speed: intensity가 높을수록 기본 속도에서의 편차를 강화
    base_speed = mapping.voice_speed
    speed_deviation = base_speed - 1.0
    adjusted_speed = 1.0 + (speed_deviation * (0.5 + intensity * 0.5))
    adjusted_speed = max(0.7, min(1.2, round(adjusted_speed, 2)))

    return EmotionMapping(
        simli_emotion_id=mapping.simli_emotion_id,
        elevenlabs_audio_tag=mapping.elevenlabs_audio_tag,
        voice_stability=adjusted_stability,
        voice_style=adjusted_style,
        voice_speed=adjusted_speed,
    )


def build_tagged_text(text: str, audio_tag: str, voice_direction: str = "") -> str:
    """
    ElevenLabs v3용 태그가 포함된 텍스트를 생성합니다.
    감정 오디오 태그와 LLM의 voice_direction을 결합합니다.

    주의: audio tag는 eleven_v3 계열 모델에서만 지원됩니다.
    eleven_flash_v2_5 등 비-v3 모델에서는 태그를 텍스트로 읽어버리므로
    호출자가 모델 호환성을 확인해야 합니다.
    """
    tags = []

    # 감정 매핑 기반 오디오 태그
    if audio_tag:
        tags.append(audio_tag)

    # LLM의 voice_direction을 영어 태그로 변환
    if voice_direction:
        direction = voice_direction.strip()
        mapped = VOICE_DIRECTION_TAG_MAP.get(direction)
        if mapped and mapped not in tags:
            tags.append(mapped)

    prefix = " ".join(tags)
    if prefix:
        return f"{prefix} {text}"
    return text
