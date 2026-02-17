"""환경변수 설정 모듈"""

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
    ELEVENLABS_MODEL_ID: str = "eleven_flash_v2_5"  # Flash v2.5: ~75ms TTS 레이턴시 (eleven_v3 대비 ~80% 절감)

    # Deepgram
    DEEPGRAM_API_KEY: str = ""

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # Beyond Presence (포토리얼 아바타)
    BEYOND_PRESENCE_API_KEY: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    PORT: int = 8000  # Railway 환경변수
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": str(ENV_PATH),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
