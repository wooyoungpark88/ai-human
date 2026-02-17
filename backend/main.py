"""FastAPI 메인 서버 - WebSocket 기반 실시간 대화 파이프라인"""

import asyncio
import base64
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel as PydanticBaseModel

from backend.config import settings
from backend.models.schemas import EmotionType, ServerMessage, ClientProfile
from backend.services.stt_service import DeepgramSTTService
from backend.services.llm_service import ClaudeLLMService
from backend.services.tts_service import ElevenLabsTTSService
from backend.services.emotion_mapper import get_emotion_mapping
from backend.services import supabase_service
from backend.services.feedback_service import FeedbackService

PROFILES_DIR = Path(__file__).resolve().parent / "client_profiles"
CASE_PROFILES_DIR = Path(__file__).resolve().parent / "case_profiles"

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 라이프사이클 관리"""
    logger.info("=== AI Avatar Conversation Server 시작 ===")
    logger.info(f"Frontend URL: {settings.FRONTEND_URL}")
    yield
    logger.info("=== AI Avatar Conversation Server 종료 ===")


app = FastAPI(
    title="AI Avatar Conversation API",
    description="실시간 음성 대화 기반 AI 아바타 시스템",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정
_cors_origins = [settings.FRONTEND_URL]
if settings.FRONTEND_URL != "http://localhost:3000":
    _cors_origins.extend(["http://localhost:3000", "http://localhost:3001"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "service": "AI Avatar Conversation API"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "deepgram": bool(settings.DEEPGRAM_API_KEY),
            "anthropic": bool(settings.ANTHROPIC_API_KEY),
            "elevenlabs": bool(settings.ELEVENLABS_API_KEY),
            "simli": bool(settings.SIMLI_API_KEY),
            "supabase": supabase_service.is_available(),
        },
    }


@app.get("/api/profiles")
async def list_profiles():
    """사용 가능한 내담자 프로필 목록을 반환합니다."""
    # Supabase에서 먼저 조회
    db_profiles = supabase_service.list_profiles()
    if db_profiles:
        return {"profiles": db_profiles}

    # Supabase 미설정 시 JSON 파일 fallback
    profiles = []
    if PROFILES_DIR.exists():
        for profile_path in PROFILES_DIR.glob("*.json"):
            try:
                with open(profile_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                profiles.append({
                    "id": data.get("id", profile_path.stem),
                    "name": data.get("name", ""),
                    "description": data.get("description", ""),
                })
            except Exception as e:
                logger.warning(f"프로필 로드 실패: {profile_path}: {e}")
    return {"profiles": profiles}


@app.get("/api/cases")
async def list_cases():
    """사용 가능한 내담자 케이스 목록을 반환합니다."""
    cases = []
    if CASE_PROFILES_DIR.exists():
        for case_path in CASE_PROFILES_DIR.glob("*.json"):
            try:
                with open(case_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cases.append({
                    "id": data.get("id", case_path.stem),
                    "name": data.get("name", ""),
                    "age": data.get("age", 0),
                    "gender": data.get("gender", ""),
                    "occupation": data.get("occupation", ""),
                    "presenting_issue": data.get("presenting_issue", ""),
                    "category": data.get("category", ""),
                    "difficulty": data.get("difficulty", "beginner"),
                    "description": data.get("description", ""),
                    "session_goals": data.get("session_goals", []),
                })
            except Exception as e:
                logger.warning(f"케이스 로드 실패: {case_path}: {e}")
    return {"cases": cases}


@app.get("/api/cases/{case_id}")
async def get_case_detail(case_id: str):
    """케이스 상세 정보를 반환합니다 (system_prompt, hidden_issues 제외)."""
    case_path = CASE_PROFILES_DIR / f"{case_id}.json"
    if not case_path.exists():
        return {"error": "케이스를 찾을 수 없습니다."}

    try:
        with open(case_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # system_prompt와 hidden_issues는 상담사에게 노출하지 않음
        data.pop("system_prompt", None)
        data.pop("hidden_issues", None)
        return data
    except Exception as e:
        logger.error(f"케이스 상세 로드 실패: {e}")
        return {"error": "케이스 로드 중 오류가 발생했습니다."}


class FeedbackMessageItem(PydanticBaseModel):
    role: str
    text: str

class FeedbackRequest(PydanticBaseModel):
    case_id: str
    messages: list[FeedbackMessageItem]

feedback_service = FeedbackService()

@app.post("/api/feedback/generate")
async def generate_feedback(request: FeedbackRequest):
    """상담 세션의 피드백을 생성합니다."""
    # 케이스 정보 로드
    case_path = CASE_PROFILES_DIR / f"{request.case_id}.json"
    case_info = {}
    if case_path.exists():
        with open(case_path, "r", encoding="utf-8") as f:
            case_info = json.load(f)

    messages = [{"role": m.role, "text": m.text} for m in request.messages]

    try:
        feedback = await feedback_service.generate_feedback(
            case_id=request.case_id,
            case_info=case_info,
            messages=messages,
        )
        return feedback.model_dump()
    except Exception as e:
        logger.error(f"피드백 생성 실패: {e}")
        return {"error": f"피드백 생성 중 오류: {str(e)}"}


class ConversationSession:
    """개별 대화 세션을 관리합니다."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.stt_service = DeepgramSTTService()
        self.llm_service = ClaudeLLMService()
        self.tts_service = ElevenLabsTTSService()
        self.is_active = False
        self.stt_available = False
        self.accumulated_text = ""
        self._stt_task: asyncio.Task | None = None
        self._conversation_lock = asyncio.Lock()
        self.conversation_id: str | None = None
        self.user_id: str | None = None
        self.case_id: str | None = None
        self.case_profile = None

    async def initialize(self, case_id: str = "burnout_beginner") -> None:
        """세션을 초기화합니다."""
        self.case_id = case_id

        # 케이스 프로필 로드 (case_profiles/ 디렉토리)
        self.case_profile = self.llm_service.load_case_profile(case_id)
        if self.case_profile:
            logger.info(f"[Case] 케이스 '{self.case_profile.name}' 로드 완료 ({self.case_profile.presenting_issue})")
        else:
            # fallback: 기존 프로필 시스템
            profile = supabase_service.load_profile(case_id)
            if profile:
                self.llm_service.system_prompt = profile.system_prompt
                logger.info(f"[Supabase] 프로필 '{profile.name}' 로드 완료")
            else:
                profile = self.llm_service.load_profile(case_id)
                if profile:
                    logger.info(f"[File] 프로필 '{profile.name}' 로드 완료")

        # conversation_id 생성 (Supabase 가용 시)
        self.conversation_id = supabase_service.create_conversation(
            user_id=self.user_id or "anonymous",
            profile_id=case_id,
        )

        # Deepgram STT 연결 (실패해도 세션은 계속 유지)
        self.stt_available = await self.stt_service.connect()
        if not self.stt_available:
            logger.warning("STT 비활성 - 텍스트 입력 모드로 전환")

        self.is_active = True
        logger.info(f"대화 세션 초기화 완료 (STT: {'활성' if self.stt_available else '비활성'}, conversation_id: {self.conversation_id})")

    async def cleanup(self) -> None:
        """세션 정리"""
        self.is_active = False
        if self._stt_task and not self._stt_task.done():
            self._stt_task.cancel()
        await self.stt_service.disconnect()
        supabase_service.end_conversation(self.conversation_id)
        logger.info("대화 세션 정리 완료")

    async def process_audio(self, audio_base64: str) -> None:
        """수신한 오디오 데이터를 STT 서비스에 전달합니다."""
        try:
            audio_bytes = base64.b64decode(audio_base64)
            logger.info(f"[Audio] 수신: {len(audio_bytes)} bytes, STT connected: {self.stt_service.is_connected}")
            await self.stt_service.send_audio(audio_bytes)
        except Exception as e:
            logger.error(f"오디오 처리 오류: {e}")

    async def run_stt_listener(self) -> None:
        """STT 트랜스크립트를 수신하고 처리하는 루프"""
        try:
            async for event in self.stt_service.get_transcripts():
                if not self.is_active:
                    break

                event_type = event.get("type")
                text = event.get("text", "")

                if event_type == "transcript":
                    is_final = event.get("is_final", False)

                    # 프론트엔드에 트랜스크립트 전송
                    await self.send_message(
                        ServerMessage(
                            type="transcript",
                            text=text,
                            is_final=is_final,
                        )
                    )

                    if is_final and text.strip():
                        self.accumulated_text += " " + text.strip()

                elif event_type == "utterance_end":
                    # 발화 종료 -> LLM 처리 시작
                    if self.accumulated_text.strip():
                        user_text = self.accumulated_text.strip()
                        self.accumulated_text = ""
                        await self._process_conversation(user_text)

        except asyncio.CancelledError:
            logger.info("STT 리스너 취소됨")
        except Exception as e:
            logger.error(f"STT 리스너 오류: {e}")

    async def _process_conversation(self, user_text: str) -> None:
        """전체 대화 파이프라인 실행: LLM -> TTS -> 전송"""
        async with self._conversation_lock:
            await self._run_pipeline(user_text)

    async def _run_pipeline(self, user_text: str) -> None:
        """파이프라인 실행 (lock 내부에서 호출)"""
        start_time = time.time()

        try:
            # Step 0: 사용자 메시지 저장
            supabase_service.save_message(
                self.conversation_id, "user", user_text
            )

            # Step 1: Claude LLM 응답 생성
            logger.info(f"[Pipeline] 사용자: {user_text}")
            await self.send_message(
                ServerMessage(type="status", text="thinking")
            )

            llm_response = await self.llm_service.generate_response(user_text)
            llm_time = time.time() - start_time
            logger.info(
                f"[Pipeline] LLM 응답 ({llm_time:.2f}s): "
                f"{llm_response.text[:50]}... | "
                f"감정: {llm_response.emotion.value}"
            )

            # Step 2: 감정 매핑
            emotion_mapping = get_emotion_mapping(
                llm_response.emotion, llm_response.intensity
            )

            # Step 3: 감정 정보 전송 (프론트엔드에서 Simli emotionId 전환에 사용)
            await self.send_message(
                ServerMessage(
                    type="emotion",
                    emotion=emotion_mapping.simli_emotion_id,
                    intensity=llm_response.intensity,
                )
            )

            # Step 4: 응답 텍스트 전송
            await self.send_message(
                ServerMessage(
                    type="response",
                    text=llm_response.text,
                    emotion=llm_response.emotion.value,
                )
            )

            # Step 5: ElevenLabs TTS 음성 생성 및 스트리밍
            tts_start = time.time()
            audio_chunk_count = 0

            async for audio_chunk in self.tts_service.synthesize_speech_streaming(
                text=llm_response.text,
                emotion_mapping=emotion_mapping,
                voice_direction=llm_response.voice_direction,
            ):
                audio_b64 = base64.b64encode(audio_chunk).decode("utf-8")
                await self.send_message(
                    ServerMessage(
                        type="audio",
                        audio_data=audio_b64,
                        is_final=False,
                    )
                )
                audio_chunk_count += 1

            # 오디오 스트리밍 종료 신호
            await self.send_message(
                ServerMessage(type="audio", is_final=True)
            )

            # Step 6: 어시스턴트 메시지 저장
            supabase_service.save_message(
                self.conversation_id,
                "assistant",
                llm_response.text,
                emotion=llm_response.emotion.value,
                intensity=llm_response.intensity,
            )

            total_time = time.time() - start_time
            tts_time = time.time() - tts_start
            logger.info(
                f"[Pipeline] 완료 | 총: {total_time:.2f}s | "
                f"LLM: {llm_time:.2f}s | TTS: {tts_time:.2f}s | "
                f"오디오 청크: {audio_chunk_count}"
            )

        except Exception as e:
            logger.error(f"대화 파이프라인 오류: {e}")
            await self.send_message(
                ServerMessage(type="error", text=str(e))
            )

    async def send_message(self, message: ServerMessage) -> None:
        """WebSocket으로 메시지를 전송합니다."""
        try:
            await self.websocket.send_json(message.model_dump(exclude_none=True))
        except Exception as e:
            logger.error(f"메시지 전송 오류: {e}")


@app.websocket("/ws/conversation")
async def websocket_conversation(websocket: WebSocket, case_id: str = "burnout_beginner"):
    """실시간 대화 WebSocket 엔드포인트"""
    await websocket.accept()
    logger.info(f"WebSocket 연결 수락 (case_id={case_id})")

    session = ConversationSession(websocket)

    try:
        # 세션 초기화 (선택된 케이스로)
        await session.initialize(case_id=case_id)

        # STT 리스너를 백그라운드 태스크로 실행 (STT 가용 시에만)
        if session.stt_available:
            session._stt_task = asyncio.create_task(session.run_stt_listener())

        # 상태 알림
        await session.send_message(
            ServerMessage(
                type="status",
                text="connected",
            )
        )

        # STT 비활성 시 텍스트 모드 안내
        if not session.stt_available:
            await session.send_message(
                ServerMessage(
                    type="status",
                    text="stt_unavailable",
                )
            )

        # 클라이언트 메시지 수신 루프
        while session.is_active:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")

                if msg_type == "audio":
                    # 오디오 데이터를 STT에 전달
                    if session.stt_available:
                        audio_data = data.get("data", "")
                        if audio_data:
                            await session.process_audio(audio_data)
                    else:
                        logger.warning("[WS] 오디오 수신했으나 STT 비활성 상태")

                elif msg_type == "text":
                    # 텍스트 직접 입력 (STT 비활성 시 또는 테스트용)
                    text = data.get("text", "").strip()
                    if text:
                        await session._process_conversation(text)

                elif msg_type == "config":
                    # 케이스 변경
                    case_id = data.get("case_id") or data.get("profile_id", "burnout_beginner")
                    case_profile = session.llm_service.load_case_profile(case_id)
                    if not case_profile:
                        # fallback: 기존 프로필 시스템
                        session.llm_service.load_profile(case_id)
                    session.llm_service.clear_history()
                    await session.send_message(
                        ServerMessage(type="status", text="profile_changed")
                    )

                elif msg_type == "stop":
                    logger.info("클라이언트 대화 종료 요청")
                    break

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                logger.warning("잘못된 JSON 메시지 수신")
            except Exception as e:
                logger.error(f"메시지 수신 오류: {e}")
                break

    except WebSocketDisconnect:
        logger.info("WebSocket 연결 끊김")
    except Exception as e:
        logger.error(f"WebSocket 세션 오류: {e}")
    finally:
        await session.cleanup()
        logger.info("WebSocket 세션 종료")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True,
    )
