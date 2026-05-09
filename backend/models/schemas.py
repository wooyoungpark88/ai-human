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
    case_id: Optional[str] = None


class ServerMessage(BaseModel):
    """백엔드에서 프론트엔드로 보내는 WebSocket 메시지"""
    type: Literal["transcript", "response", "audio", "emotion", "error", "status"]
    text: Optional[str] = None
    emotion: Optional[str] = None
    intensity: Optional[float] = None
    audio_data: Optional[str] = None  # base64 인코딩된 오디오 데이터
    is_final: bool = False
    user_text: Optional[str] = None  # thinking 상태에서 확정된 사용자 발화 텍스트


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


AvatarType = Literal["vrm", "simli", "flashhead", "deepbrain", "heygen"]


class ClinicalInfo(BaseModel):
    """임상 추정 정보 — DSM-5/ICD-11 기반"""
    primary_diagnosis: Optional[str] = None  # "MDD (recurrent, moderate)" 같은 추정
    comorbid: list[str] = []                 # 공존질환
    onset_date: Optional[str] = None         # "2025-12 경"
    chronicity: Optional[str] = None         # acute / subacute / chronic
    icd11_code: Optional[str] = None


class RiskAssessment(BaseModel):
    """위험 평가 4축 (0=없음, 1=수동적, 2=계획 단계, 3=즉시 위험)"""
    suicide: int = 0
    self_harm: int = 0
    harm_others: int = 0
    substance: int = 0
    warning_signs: list[str] = []


class TriggerItem(BaseModel):
    topic: str
    reaction: str
    intensity: float = 0.5  # 0.0~1.0


class RelationshipNode(BaseModel):
    role: str          # "남편" "아들" 등
    age: Optional[int] = None
    quality: Optional[str] = None      # 단절 / 거리감 / 친밀 / 갈등
    dynamics: Optional[str] = None     # 자유 텍스트


class ResistanceCurve(BaseModel):
    initial: float = 0.5
    after_rapport: float = 0.3
    trust_gates: list[str] = []        # "감정 반영 3회 이상" 등


class SessionPhase(BaseModel):
    phase: str                          # 초기 / 탐색 / 핵심 노출
    behavior: str
    duration_turns: Optional[str] = None
    trigger: Optional[str] = None       # 다음 단계 진입 트리거


class RubricItem(BaseModel):
    pattern: str                        # "감정 반영" "성급한 조언"
    example: Optional[str] = None
    weight: float = 1.0                 # 양수=좋음, 음수=나쁨


class Rubric(BaseModel):
    good_responses: list[RubricItem] = []
    bad_responses: list[RubricItem] = []


class SafetyProtocols(BaseModel):
    crisis_signals: list[str] = []                  # "사라지고 싶다" 등
    expected_counselor_response: Optional[str] = None
    ideal_response_example: Optional[str] = None


class CaseProfile(BaseModel):
    """상담 훈련용 내담자 케이스 프로필 — AI가 연기할 인물 (v2)"""
    id: str
    name: str
    age: int
    gender: str
    occupation: str
    presenting_issue: str
    category: str
    difficulty: str
    description: str
    personality: str
    speaking_style: str
    background_story: str
    symptoms: list[str] = []
    hidden_issues: list[str] = []
    emotional_baseline: str = "neutral"
    resistance_level: float = 0.5
    session_goals: list[str] = []
    system_prompt: str
    voice_id: Optional[str] = None
    face_id: Optional[str] = None

    # === v2 신규 — 임상 깊이 ===
    clinical: Optional[ClinicalInfo] = None
    risk_assessment: Optional[RiskAssessment] = None
    defense_mechanisms: list[str] = []           # ["회피", "지성화"] 등
    triggers: list[TriggerItem] = []
    relationships: list[RelationshipNode] = []
    developmental_history: Optional[str] = None
    trauma_history: list[str] = []
    strengths: list[str] = []
    support_system: list[str] = []
    coping_resources: list[str] = []
    resistance_curve: Optional[ResistanceCurve] = None
    session_phases: list[SessionPhase] = []
    rubric: Optional[Rubric] = None
    safety_protocols: Optional[SafetyProtocols] = None
    cultural_context: list[str] = []
    schema_version: int = 1               # 1=legacy, 2=신 빌더 생성

    # === 정적 초상화 (AI 생성) — 영상 아바타와 별개 ===
    portrait_url: Optional[str] = None  # 단일 또는 neutral 변형 (호환성)
    portrait_variants: Optional[dict[str, str]] = None  # 감정별 8장 (neutral/happy/sad/angry/surprised/thinking/anxious/empathetic)
    portrait_prompt: Optional[str] = None

    # === 아바타 매핑 (실시간 영상 AI 휴먼) ===
    avatar_type: Optional[AvatarType] = None
    flashhead_model_id: Optional[str] = None
    deepbrain_avatar_id: Optional[str] = None
    heygen_avatar_id: Optional[str] = None
    external_url: Optional[str] = None


class FeedbackCategory(BaseModel):
    """피드백 평가 항목"""
    name: str
    name_en: str
    score: float
    comment: str


class SessionFeedback(BaseModel):
    """상담 세션 피드백 결과"""
    session_id: str = ""
    case_id: str = ""
    overall_score: float
    categories: list[FeedbackCategory]
    summary: str
    strengths: list[str]
    improvements: list[str]
    recommendations: list[str]
