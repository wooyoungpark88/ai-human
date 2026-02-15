"""Pydantic 데이터 모델 정의"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class EmotionType(str, Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISED = "surprised"
    THINKING = "thinking"
    ANXIOUS = "anxious"
    EMPATHETIC = "empathetic"


class LLMResponse(BaseModel):
    """Claude LLM이 반환하는 JSON 응답 구조"""
    text: str = Field(description="실제 대화 내용")
    emotion: EmotionType = Field(default=EmotionType.NEUTRAL, description="감정 태그")
    intensity: float = Field(default=0.5, ge=0.0, le=1.0, description="감정 강도")
    voice_direction: str = Field(default="", description="감정 표현 힌트")


class EmotionMapping(BaseModel):
    """감정 매핑 결과"""
    simli_emotion_id: str
    elevenlabs_audio_tag: str
    voice_stability: float
    voice_style: float
    voice_speed: float = 1.0  # ElevenLabs speed (0.7~1.2)


class ClientMessage(BaseModel):
    """프론트엔드에서 백엔드로 보내는 WebSocket 메시지"""
    type: Literal["audio", "config", "stop", "text"]
    data: Optional[str] = None  # base64 인코딩된 오디오 데이터
    text: Optional[str] = None  # 텍스트 직접 입력
    profile_id: Optional[str] = None


class ServerMessage(BaseModel):
    """백엔드에서 프론트엔드로 보내는 WebSocket 메시지"""
    type: Literal["transcript", "response", "audio", "emotion", "error", "status"]
    text: Optional[str] = None
    emotion: Optional[str] = None
    intensity: Optional[float] = None
    audio_data: Optional[str] = None  # base64 인코딩된 오디오 데이터
    is_final: bool = False


class ClientProfile(BaseModel):
    """내담자 프로필"""
    id: str
    name: str
    description: str
    personality: str
    speaking_style: str
    background_story: str
    system_prompt: str
    face_id: Optional[str] = None
    voice_id: Optional[str] = None
