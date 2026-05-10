"""FastAPI 메인 서버 - WebSocket 기반 실시간 대화 파이프라인"""

import asyncio
import base64
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

import httpx
import jwt
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
from backend.utils import load_json_file

PROFILES_DIR = Path(__file__).resolve().parent / "client_profiles"
CASE_PROFILES_DIR = Path(__file__).resolve().parent / "case_profiles"
PORTRAITS_DIR = Path(__file__).resolve().parent / "portraits"
PORTRAITS_DIR.mkdir(exist_ok=True)

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
            data = load_json_file(profile_path)
            if data is None:
                continue
            profiles.append({
                "id": data.get("id", profile_path.stem),
                "name": data.get("name", ""),
                "description": data.get("description", ""),
            })
    return {"profiles": profiles}


@app.get("/api/cases")
async def list_cases():
    """사용 가능한 내담자 케이스 목록을 반환합니다."""
    cases = []
    if CASE_PROFILES_DIR.exists():
        for case_path in CASE_PROFILES_DIR.glob("*.json"):
            data = load_json_file(case_path)
            if data is None:
                continue
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
                "avatar_type": data.get("avatar_type", "vrm"),
                "simli_face_id": data.get("simli_face_id", ""),
                "flashhead_model_id": data.get("flashhead_model_id", ""),
                "deepbrain_avatar_id": data.get("deepbrain_avatar_id", ""),
                "heygen_avatar_id": data.get("heygen_avatar_id", ""),
                "external_url": data.get("external_url", ""),
                "portrait_url": data.get("portrait_url", ""),
                "portrait_variants": data.get("portrait_variants") or {},
            })
    return {"cases": cases}


@app.get("/api/cases/{case_id}")
async def get_case_detail(case_id: str, include_internal: bool = False):
    """케이스 상세 정보를 반환합니다.

    기본: 상담사 훈련 모드 — system_prompt / hidden_issues 제외 (정답 비공개)
    include_internal=true: 페르소나 명세 검토용 — 모든 필드 포함
    """
    data = load_json_file(CASE_PROFILES_DIR / f"{case_id}.json")
    if data is None:
        return {"error": "케이스를 찾을 수 없습니다."}
    if not include_internal:
        # 훈련 중에는 정답·내부 데이터 노출 금지
        data.pop("system_prompt", None)
        data.pop("hidden_issues", None)
    return data


_PROMPT_GEN_FEW_SHOT = """예시 1 (anxiety_beginner — 48세 여성, 부부갈등·우울, resistance 0.3):
당신은 상담 훈련용 시뮬레이션의 내담자(환자) 역할을 합니다. 절대로 상담사 역할을 하지 마세요.

## 당신의 인물 정보
- 이름: 이준호
- 나이: 48세, 여성
...

## 행동 지침
1. 처음에는 "요즘 좀... 우울해서요. 별일 아닌데 눈물이 나요." 같이 표면적인 이야기로 시작하세요
2. 상담사가 공감적으로 들어주면 남편 이야기를 조금씩 꺼내세요
3. ...
8. 첫 인사는 "안녕하세요... 친구가 상담 한번 받아보라고 해서 왔어요." 같은 느낌으로 시작하세요

## 말투
- 존댓말 사용
- 한숨이 많음 ("하...")
- 체념적 표현 ("뭐 어쩌겠어요", "다 그런 거죠")

## 저항도: 0.3 (낮음 - 비교적 협조적)

모든 응답은 반드시 아래 JSON 형식으로만 출력하세요...
{
  "text": "...",
  "emotion": "happy|sad|angry|surprised|thinking|neutral|empathetic|anxious",
  "intensity": 0.0~1.0,
  "voice_direction": "..."
}

한국어로 자연스럽게 대화하세요. 답변은 1~2문장으로 간결하게 하세요.
"""


def _render_prompt_template(data: dict) -> str:
    """구조화된 페르소나 데이터를 고정 템플릿에 슬롯팅 — AI 호출 없이 즉시 생성."""
    name = data.get("name", "")
    age = data.get("age", 0)
    gender = data.get("gender", "")
    occupation = data.get("occupation", "")
    personality = data.get("personality", "")
    presenting_issue = data.get("presenting_issue", "")
    background_story = data.get("background_story", "")
    speaking_style = data.get("speaking_style", "")
    symptoms = data.get("symptoms", []) or []
    hidden_issues = data.get("hidden_issues", []) or []
    triggers = data.get("triggers", []) or []
    defenses = data.get("defense_mechanisms", []) or []
    strengths = data.get("strengths", []) or []
    safety = data.get("safety_protocols") or {}
    curve = data.get("resistance_curve") or {}
    initial_resist = curve.get("initial", data.get("resistance_level", 0.5))

    sym_block = "\n".join(f"- {s}" for s in symptoms) if symptoms else "- (해당 없음)"
    hidden_block = "\n".join(f"- {h}" for h in hidden_issues) if hidden_issues else "- (없음)"
    trigger_block = "\n".join(
        f"- '{t.get('topic')}' 주제 → {t.get('reaction')} (강도 {t.get('intensity', 0.5)})"
        for t in triggers
    ) or "- (특별한 트리거 없음)"
    defense_block = ", ".join(defenses) or "특별한 방어기제 없음"
    strength_block = ", ".join(strengths) or "(미파악)"
    crisis_block = ""
    if safety.get("crisis_signals"):
        crisis_block = (
            "\n## 위기 신호 (등장 시 자연스럽게 흘리되 강조하지 말 것)\n"
            + "\n".join(f"- {c}" for c in safety["crisis_signals"])
        )

    return f"""당신은 상담 훈련용 시뮬레이션의 내담자(환자) 역할을 합니다. 절대로 상담사 역할을 하지 마세요.

## 당신의 인물 정보
- 이름: {name}
- 나이: {age}세, {gender}
- 직업: {occupation}
- 성격: {personality}

## 호소 문제
{presenting_issue}

## 증상
{sym_block}

## 배경 스토리
{background_story}

## 숨겨진 이슈 (상담이 진행되면서 점차 드러나야 함)
{hidden_block}
이 이슈들은 처음부터 말하지 말고, 상담사가 공감적으로 탐색하면 조금씩 드러내세요.

## 트리거 주제
{trigger_block}

## 주요 방어기제
{defense_block}

## 본인의 강점·자원 (숨김 — 상담사가 발견하면 드러남)
{strength_block}
{crisis_block}

## 행동 지침
1. 첫 인사는 어색하고 짧게, 본격적인 호소 전 단계의 표면적 멘트로 시작하세요
2. 상담사가 공감적으로 들어주면 조금씩 마음을 열어가세요
3. 성급한 조언이나 판단을 받으면 살짝 방어적·회피적으로 반응하세요
4. 감정을 직접 말하기보다 상황·신체 증상으로 표현하세요
5. 말은 1~2문장으로 짧게, 내담자는 상담사보다 말이 적어야 합니다

## 말투
{speaking_style}

## 저항도: {initial_resist} (신뢰가 형성되면 점차 낮아집니다)

모든 응답은 반드시 아래 JSON 형식으로만 출력하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요:
{{
  "text": "실제 대화 내용",
  "emotion": "happy|sad|angry|surprised|thinking|neutral|empathetic|anxious",
  "intensity": 0.0~1.0,
  "voice_direction": "감정 표현 힌트 (예: 조용히, 울먹이며, 밝게)"
}}

한국어로 자연스럽게 대화하세요.
"""


class GeneratePromptRequest(PydanticBaseModel):
    """페르소나 빌더에서 system_prompt 자동 생성 요청 — 모든 필드 자유 dict 허용"""
    persona: dict
    mode: Literal["ai", "template"] = "ai"


@app.post("/api/cases/generate-prompt")
async def generate_case_prompt(request: GeneratePromptRequest):
    """
    빌더에서 입력된 구조화 페르소나 데이터로 system_prompt를 생성.
    mode="template": 고정 템플릿 슬롯팅 (즉시, AI 호출 없음)
    mode="ai": Claude로 일관된 톤의 프롬프트 작성 (예제 케이스 few-shot)
    """
    if request.mode == "template":
        prompt = _render_prompt_template(request.persona)
        return {"prompt": prompt, "mode": "template"}

    # AI 생성
    if not settings.ANTHROPIC_API_KEY:
        return {"error": "ANTHROPIC_API_KEY 미설정"}
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        persona_json = json.dumps(request.persona, ensure_ascii=False, indent=2)
        meta_prompt = f"""당신은 상담 훈련 플랫폼의 페르소나 작성 전문가입니다.
아래 구조화된 내담자 페르소나 데이터를 받아, AI가 시뮬레이션 내담자 역할을 일관되게 연기할 수 있도록
한국어로 system_prompt를 작성하세요.

## 작성 원칙
- 기존 케이스(아래 예시) 스타일과 톤을 그대로 따르세요 — "## 인물 정보 / ## 호소 문제 / ## 증상 / ## 배경 / ## 숨겨진 이슈 / ## 행동 지침 (번호) / ## 말투 / ## 저항도" 헤더 구조
- hidden_issues는 반드시 "처음부터 말하지 말고, 점진적 공개" 명시
- 행동 지침은 6~8개 번호 항목, 각각 "상담사가 X하면 → 내담자 Y"의 조건-반응 형태
- 첫 인사 문장 1개를 정확히 명시 (큰따옴표로 인용)
- 말투는 연령·성격에 맞는 한국어 표현 예시 3~5개 포함
- 마지막에 반드시 JSON 응답 강제 블록 포함:
  {{ "text": "...", "emotion": "happy|sad|angry|surprised|thinking|neutral|empathetic|anxious", "intensity": 0.0~1.0, "voice_direction": "..." }}
- 출력은 system_prompt 본문만 — 설명·머리말·코드 블록 없이 평문으로

{_PROMPT_GEN_FEW_SHOT}

## 새로 작성할 페르소나 데이터
```json
{persona_json}
```

위 데이터로 system_prompt만 작성하세요. 다른 텍스트 절대 금지."""

        msg = await client.messages.create(
            model="claude-opus-4-7",
            max_tokens=2500,
            messages=[{"role": "user", "content": meta_prompt}],
        )
        # content는 list[TextBlock]
        text = "".join(
            block.text for block in msg.content if hasattr(block, "text")
        )
        return {"prompt": text.strip(), "mode": "ai"}
    except Exception as e:
        logger.error(f"system_prompt AI 생성 실패: {e}")
        return {"error": str(e)}


PORTRAIT_EMOTIONS = [
    "neutral", "happy", "sad", "angry",
    "surprised", "thinking", "anxious", "empathetic",
]

_EMOTION_HINTS = {
    "neutral":    "calm neutral expression, relaxed mouth, soft eye contact",
    "happy":      "warm gentle smile, light eye creases, comfortable expression",
    "sad":        "soft melancholic expression, slight downturn at mouth, tired eyes, gentle gaze",
    "angry":      "controlled tension in jaw, slight frown between brows, lips pressed, restrained",
    "surprised":  "slightly raised eyebrows, parted lips, alert eyes, gentle surprise (not exaggerated)",
    "thinking":   "thoughtful pensive look, gaze slightly off-camera, hand near chin allowed, contemplative",
    "anxious":    "subtle worry between brows, slight tension around eyes, lips slightly tight, uneasy",
    "empathetic": "compassionate soft eyes, slightly tilted head, warm understanding expression",
}


def _build_portrait_prompt(persona: dict, emotion: str = "neutral") -> str:
    """페르소나 데이터 + 감정으로 DALL-E 프롬프트 생성.

    한국인 실사 사실주의 사진 — 다큐멘터리 카메라 표현으로 진짜 사람 톤 강화.
    동일 인물 일관성을 위해 시드(case_id) + 외모 단서 고정.
    """
    age = persona.get("age", 30)
    gender_raw = persona.get("gender", "여성")
    gender_en = "woman" if gender_raw == "여성" else "man" if gender_raw == "남성" else "person"
    occupation = (persona.get("occupation") or "office worker").replace("\n", " ")[:120]
    personality = (persona.get("personality") or "").replace("\n", " ")[:160]
    name_seed = persona.get("id") or persona.get("name") or "subject"

    emotion_hint = _EMOTION_HINTS.get(emotion, _EMOTION_HINTS["neutral"])

    # 연령대별 한국인 외모 단서 — 일관성·사실성 강화
    if age < 20:
        age_band = "Korean teenager, fresh youthful face, school-age"
    elif age < 30:
        age_band = "young Korean adult in their twenties, clear smooth skin"
    elif age < 40:
        age_band = "Korean adult in their thirties, mature confident face"
    elif age < 50:
        age_band = "Korean adult in their forties, subtle expression lines"
    else:
        age_band = "middle-aged Korean adult, natural age signs around eyes"

    return (
        f"Hyper-realistic documentary photograph, vertical portrait of a real Korean {gender_en}, "
        f"age {age}. {age_band}. Working as a {occupation}. "
        f"{emotion_hint}. "
        f"Authentic East Asian facial features: warm ivory skin tone with natural undertones, "
        f"naturally proportioned face, dark brown or black hair, "
        f"almond-shaped eyes with monolid or natural double eyelid, "
        f"realistic Korean styling — natural minimal makeup if applicable, contemporary K-fashion. "
        f"Personality conveyed through expression: {personality}. "
        f"Shot on Canon EOS R5 with 50mm f/1.8 lens, soft natural window light, "
        f"shallow depth of field, neutral warm-toned indoor background, head-and-shoulders framing. "
        f"Photographic realism: visible skin pores, natural skin imperfections, "
        f"realistic hair strands, subtle eye catchlight, unedited candid feel. "
        f"NO airbrushing, NO plastic look, NO CGI, NO illustration, NO anime style — "
        f"this must look like a real photograph of a real person. "
        f"Identity seed [{name_seed}]: same face, hairstyle, and clothing across all emotion variants. "
        f"Single subject, modest framing, no text, no watermarks, no logos, no captions. "
        f"For professional counseling training material — dignified and authentic."
    )


class GeneratePortraitRequest(PydanticBaseModel):
    """페르소나 초상화 생성 요청 — 단일 또는 8가지 감정 변형"""
    persona: dict
    prompt_override: Optional[str] = None
    case_id: Optional[str] = None
    emotions: Optional[list[str]] = None  # None 또는 ["neutral"] = 단일, [...8] = 변형 묶음


async def _gen_one_image(
    client: httpx.AsyncClient,
    prompt: str,
    size: str = "1024x1792",
) -> bytes:
    """OpenAI 이미지 생성 1장 → JPEG bytes 반환.

    quality="hd" + JPEG q=92 4:4:4 chroma — DALL-E 3 최상 품질 + 압축 손실 최소화.
    """
    r = await client.post(
        "https://api.openai.com/v1/images/generations",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.PORTRAIT_MODEL,
            "prompt": prompt,
            "size": size,
            "quality": "hd",  # 2배 비용, 더 사실적·세밀한 디테일
            "n": 1,
            "response_format": "b64_json",
        },
        timeout=180.0,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:200]}")
    data = r.json()
    b64 = data["data"][0].get("b64_json")
    if b64:
        png_bytes = base64.b64decode(b64)
    else:
        img_url = data["data"][0].get("url")
        if not img_url:
            raise RuntimeError("OpenAI 응답에 이미지 데이터 없음")
        png_bytes = (await client.get(img_url)).content

    # PNG → JPEG (q=92, 4:4:4 full chroma, progressive) — HD 화질 보존
    try:
        from PIL import Image
        from io import BytesIO
        with Image.open(BytesIO(png_bytes)) as im:
            im = im.convert("RGB")
            buf = BytesIO()
            # subsampling=0 → 4:4:4 (색상 해상도 풀, 미세 디테일 보존)
            im.save(buf, "JPEG", quality=92, optimize=True, progressive=True, subsampling=0)
            return buf.getvalue()
    except Exception as e:
        logger.warning(f"JPEG 변환 실패, PNG 그대로 사용: {e}")
        return png_bytes


@app.post("/api/cases/generate-portrait")
async def generate_portrait(request: GeneratePortraitRequest):
    """OpenAI 이미지 모델로 페르소나 초상화 생성.

    실시간 영상 AI 휴먼(HeyGen/Simli/DeepBrain/VRM)과는 완전히 별개의 정적 이미지.
    emotions 미지정/단일: 1장만 생성 → portrait_url 용
    emotions=[8개]: 동일 인물 시드 + 표정 다른 8장 → portrait_variants 용

    동시 호출 4건으로 cap (DALL-E 3 RPM 한계 회피).
    """
    if not settings.OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY 미설정 — backend .env에 추가 필요"}

    case_id = request.case_id or request.persona.get("id") or ""
    file_prefix = case_id if case_id and _VALID_ID.match(case_id) else f"tmp_{int(time.time() * 1000)}"

    emotions = request.emotions or ["neutral"]
    # 정해진 8개 외 무시
    emotions = [e for e in emotions if e in PORTRAIT_EMOTIONS]
    if not emotions:
        emotions = ["neutral"]

    sem = asyncio.Semaphore(4)
    variants: dict[str, str] = {}
    primary_url: Optional[str] = None
    last_prompt = ""

    async def _do(emotion: str) -> tuple[str, Optional[str], Optional[str]]:
        nonlocal last_prompt
        prompt = request.prompt_override or _build_portrait_prompt(request.persona, emotion)
        last_prompt = prompt
        async with sem:
            try:
                async with httpx.AsyncClient(timeout=130.0) as client:
                    img_bytes = await _gen_one_image(client, prompt)
                # 단일이면 base, 다중이면 emotion suffix
                if len(emotions) == 1 and emotion == "neutral":
                    fname = f"{file_prefix}.jpg"
                else:
                    fname = f"{file_prefix}_{emotion}.jpg"
                (PORTRAITS_DIR / fname).write_bytes(img_bytes)
                logger.info(f"초상화 [{emotion}] 생성됨: {fname} ({len(img_bytes)} bytes)")
                return (emotion, f"/api/portraits/{fname}", None)
            except Exception as e:
                logger.error(f"초상화 [{emotion}] 실패: {e}")
                return (emotion, None, str(e))

    results = await asyncio.gather(*(_do(e) for e in emotions))
    errors: list[str] = []
    for emo, url, err in results:
        if url:
            variants[emo] = url
            if emo == "neutral":
                primary_url = url
        else:
            errors.append(f"{emo}: {err}")

    if not variants:
        return {"error": f"전체 생성 실패 — {errors[0] if errors else 'unknown'}"}
    if not primary_url:
        primary_url = next(iter(variants.values()))

    return {
        "url": primary_url,
        "variants": variants,
        "prompt_used": last_prompt,
        "errors": errors or None,
        "filename": Path(primary_url).name,
    }


@app.get("/api/portraits/{filename}")
async def serve_portrait(filename: str):
    """저장된 초상화 이미지 서빙 — path traversal 방지 위해 파일명 정규식 검증."""
    from fastapi.responses import FileResponse, JSONResponse
    if not re.match(r"^[a-zA-Z0-9_\-]{1,60}\.(png|jpg|jpeg|webp)$", filename):
        return JSONResponse({"error": "잘못된 파일명"}, status_code=400)
    target = PORTRAITS_DIR / filename
    if not target.exists():
        return JSONResponse({"error": "파일 없음"}, status_code=404)
    ext = target.suffix.lower().lstrip(".")
    media = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }.get(ext, "application/octet-stream")
    return FileResponse(target, media_type=media)


_VALID_ID = re.compile(r"^[a-z0-9_]{2,40}$")


class SaveCaseRequest(PydanticBaseModel):
    """페르소나 빌더에서 케이스 저장 요청"""
    profile: dict
    overwrite: bool = False


@app.post("/api/cases/save")
async def save_case(request: SaveCaseRequest):
    """빌더에서 작성한 페르소나를 case_profiles/{id}.json 으로 저장."""
    profile = request.profile or {}
    case_id = (profile.get("id") or "").strip()
    if not _VALID_ID.match(case_id):
        return {
            "error": "id는 2~40자의 소문자·숫자·_ 만 허용됩니다 (예: my_new_case)"
        }
    required = ["name", "age", "gender", "occupation", "presenting_issue",
                "category", "difficulty", "description", "personality",
                "speaking_style", "background_story", "system_prompt"]
    missing = [f for f in required if not profile.get(f)]
    if missing:
        return {"error": f"필수 필드 누락: {', '.join(missing)}"}

    target_path = CASE_PROFILES_DIR / f"{case_id}.json"
    if target_path.exists() and not request.overwrite:
        return {"error": f"'{case_id}' 케이스가 이미 존재합니다. overwrite=true로 재시도하세요."}

    # schema_version 기록
    profile.setdefault("schema_version", 2)

    try:
        CASE_PROFILES_DIR.mkdir(exist_ok=True)
        target_path.write_text(
            json.dumps(profile, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info(f"케이스 저장됨: {case_id}")
        return {"saved": True, "id": case_id, "path": str(target_path)}
    except Exception as e:
        logger.error(f"케이스 저장 실패: {e}")
        return {"error": str(e)}


@app.get("/api/heygen/token")
async def heygen_token():
    """HeyGen Interactive Avatar용 access token 발급.

    클라이언트는 짧은 수명의 access token만 받아 StreamingAvatar SDK에 사용.
    HEYGEN_API_KEY는 서버 비밀로 보호.
    """
    if not settings.HEYGEN_API_KEY:
        return {"error": "HEYGEN_API_KEY 미설정"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://api.heygen.com/v1/streaming.create_token",
                headers={"x-api-key": settings.HEYGEN_API_KEY},
            )
            if r.status_code >= 400:
                logger.error(f"HeyGen token 발급 실패: {r.status_code} {r.text}")
                return {"error": f"{r.status_code}: {r.text[:200]}"}
            data = r.json()
            return {
                "token": data.get("data", {}).get("token"),
                "default_avatar": settings.HEYGEN_DEFAULT_AVATAR,
            }
    except Exception as e:
        logger.error(f"HeyGen token 발급 오류: {e}")
        return {"error": str(e)}


@app.get("/api/sidecar/oac/health")
async def oac_sidecar_health():
    """OpenAvatarChat 사이드카 도달 가능성 확인.

    프론트엔드 CaseCard가 OAC 케이스 표시 시 폴링하여 '미연결' 안내에 사용.
    self-signed cert 사용하므로 verify=False, 짧은 timeout.
    """
    url = settings.FLASHHEAD_SIDECAR_URL or "https://localhost:8282"
    try:
        async with httpx.AsyncClient(verify=False, timeout=2.0) as client:
            r = await client.get(url, follow_redirects=False)
            return {"reachable": True, "status": r.status_code, "url": url}
    except httpx.ConnectError:
        return {"reachable": False, "reason": "connection_refused", "url": url}
    except httpx.TimeoutException:
        return {"reachable": False, "reason": "timeout", "url": url}
    except Exception as e:
        return {"reachable": False, "reason": str(e)[:80], "url": url}


@app.get("/api/deepbrain/jwt")
async def deepbrain_jwt():
    """DeepBrain AI Human Web SDK용 JWT 발급.

    클라이언트가 GET 호출 → AIPlayer.generateToken({appId, token})에 그대로 전달.
    userKey는 서버 비밀이라 응답에 포함하지 않음.
    """
    if not settings.DEEPBRAIN_APP_ID or not settings.DEEPBRAIN_USER_KEY:
        return {"error": "DEEPBRAIN_APP_ID/USER_KEY 미설정"}
    try:
        now = int(time.time())
        payload = {
            "appId": settings.DEEPBRAIN_APP_ID,
            "platform": "web",
            "iat": now,
            "exp": now + 60 * 5,  # 5분 만료 (샘플 동일)
        }
        token = jwt.encode(
            payload,
            settings.DEEPBRAIN_USER_KEY,
            algorithm="HS256",
            headers={"typ": "JWT", "alg": "HS256"},
        )
        return {"appId": settings.DEEPBRAIN_APP_ID, "token": token}
    except Exception as e:
        logger.error(f"DeepBrain JWT 발급 실패: {e}")
        return {"error": str(e)}


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
    case_info = load_json_file(CASE_PROFILES_DIR / f"{request.case_id}.json") or {}

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

    def __init__(self, websocket: WebSocket, mode: str = "full"):
        self.websocket = websocket
        self.mode = mode  # "full" | "stt_only"
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

        # stt_only 모드: STT만 초기화 (LLM/TTS 불필요)
        if self.mode == "stt_only":
            self.stt_available = await self.stt_service.connect()
            if not self.stt_available:
                logger.warning("STT 비활성 - stt_only 모드에서 STT 연결 실패")
            self.is_active = True
            logger.info(f"대화 세션 초기화 완료 (stt_only 모드, STT: {'활성' if self.stt_available else '비활성'})")
            return

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
        """STT 트랜스크립트를 수신하고 처리하는 루프

        레이턴시 최적화: speech_final 이벤트에서 즉시 LLM 호출 (endpointing 기반, ~300ms).
        utterance_end는 fallback으로만 사용 (~1000ms).
        """
        try:
            async for event in self.stt_service.get_transcripts():
                if not self.is_active:
                    break

                event_type = event.get("type")
                text = event.get("text", "")

                if event_type == "transcript":
                    is_final = event.get("is_final", False)
                    speech_final = event.get("speech_final", False)

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

                    # speech_final: endpointing 기반 발화 종료
                    if speech_final and self.accumulated_text.strip():
                        user_text = self.accumulated_text.strip()
                        self.accumulated_text = ""
                        if self.mode == "stt_only":
                            # STT-only: 텍스트만 전달, LLM/TTS 파이프라인 건너뜀
                            logger.info(f"[STT] speech_final (stt_only): {user_text}")
                            await self.send_message(
                                ServerMessage(type="status", text="thinking", user_text=user_text)
                            )
                        else:
                            logger.info(f"[STT] speech_final 트리거 → LLM 호출")
                            await self._process_conversation(user_text)

                elif event_type == "utterance_end":
                    # fallback: speech_final이 누락된 경우에만 트리거
                    if self.accumulated_text.strip():
                        user_text = self.accumulated_text.strip()
                        self.accumulated_text = ""
                        if self.mode == "stt_only":
                            logger.info(f"[STT] utterance_end (stt_only): {user_text}")
                            await self.send_message(
                                ServerMessage(type="status", text="thinking", user_text=user_text)
                            )
                        else:
                            logger.info(f"[STT] utterance_end fallback → LLM 호출")
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
                ServerMessage(type="status", text="thinking", user_text=user_text)
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
async def websocket_conversation(websocket: WebSocket, case_id: str = "burnout_beginner", mode: str = "full"):
    """실시간 대화 WebSocket 엔드포인트"""
    await websocket.accept()
    logger.info(f"WebSocket 연결 수락 (case_id={case_id}, mode={mode})")

    session = ConversationSession(websocket, mode=mode)

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
