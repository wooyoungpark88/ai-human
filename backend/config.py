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
    # eleven_v3: audio 태그([cheerfully] 등) 지원 + 음색이 박지영 등 voice_id=None
    # 케이스의 기존 운영 음성과 일치. 첫 청크 지연(~500-1000ms)은 _run_pipeline의
    # hybrid pacing 및 BURST_PREFIX_COUNT로 보완.
    # (이전 flash_v2_5 변경은 음색 변동을 일으켜 사용자 요청으로 되돌림)
    ELEVENLABS_MODEL_ID: str = "eleven_v3"

    # Deepgram
    DEEPGRAM_API_KEY: str = ""

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # FlashHead 사이드카 (OpenAvatarChat 기반 로컬 아바타 엔진)
    # 미설정 시 flashhead avatar_type은 비활성 — Simli/VRM으로 fallback
    FLASHHEAD_SIDECAR_URL: str = ""

    # DeepBrain AI Human Web SDK (aihuman.aistudios.com)
    # userKey는 절대 클라이언트에 노출 금지 — 서버에서만 JWT 서명에 사용
    DEEPBRAIN_APP_ID: str = ""
    DEEPBRAIN_USER_KEY: str = ""

    # HeyGen Interactive Avatar Streaming API
    # api key는 서버 비밀 — 클라이언트는 서버가 발급한 짧은 access token만 사용
    HEYGEN_API_KEY: str = ""
    HEYGEN_DEFAULT_AVATAR: str = "June_HR_public"  # HeyGen 기본 아바타 ID

    # OpenAI — (사용 안 함, 폴백용 보존)
    OPENAI_API_KEY: str = ""
    PORTRAIT_MODEL: str = "dall-e-3"

    # Replicate — Flux 1.1 Pro Ultra (한국인 사실 인물 초상화 생성)
    # https://replicate.com/black-forest-labs/flux-1.1-pro-ultra
    # 미설정 시 portrait 생성 비활성
    REPLICATE_API_TOKEN: str = ""
    REPLICATE_PORTRAIT_MODEL: str = "black-forest-labs/flux-1.1-pro-ultra"

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
