"""환경변수 설정 모듈"""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from pathlib import Path

# 프로젝트 루트의 .env 파일 경로
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # Simli
    SIMLI_API_KEY: str = ""
    SIMLI_FACE_ID: str = ""

    # ElevenLabs
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = ""
    ELEVENLABS_MODEL_ID: str = "eleven_v3"  # v3: 오디오 태그 지원 ([cheerfully] 등) — 감정 프로소디 표현 활성화

    # Deepgram
    DEEPGRAM_API_KEY: str = ""

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # Beyond Presence (포토리얼 아바타)
    BEYOND_PRESENCE_API_KEY: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # FlashHead 사이드카 (OpenAvatarChat 기반 로컬 아바타 엔진)
    # 미설정 시 flashhead avatar_type은 비활성 — Simli/VRM으로 fallback
    FLASHHEAD_SIDECAR_URL: str = ""

    # Server — Railway는 PORT를 주입하므로 BACKEND_PORT/PORT 둘 다 허용
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = Field(
        default=8000,
        validation_alias=AliasChoices("BACKEND_PORT", "PORT"),
    )
    FRONTEND_URL: str = "http://localhost:3000"

    # 대화 기록 보존 길이 (사용자/어시스턴트 메시지 합산)
    MAX_CONVERSATION_HISTORY: int = 20

    model_config = {
        "env_file": str(ENV_PATH),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
