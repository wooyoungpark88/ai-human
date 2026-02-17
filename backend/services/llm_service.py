"""Claude LLM 대화 생성 + 감정 태그 서비스"""

import json
import logging
from typing import Optional
from pathlib import Path

import anthropic

from backend.config import settings
from backend.models.schemas import LLMResponse, EmotionType, ClientProfile, CaseProfile

logger = logging.getLogger(__name__)

# 기본 시스템 프롬프트 (감정 태그 JSON 출력 강제)
DEFAULT_SYSTEM_PROMPT = """당신은 대화 상대입니다. 사용자의 말에 공감하며 자연스럽게 대화하세요.

모든 응답은 반드시 아래 JSON 형식으로만 출력하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요:
{
  "text": "실제 대화 내용",
  "emotion": "happy|sad|angry|surprised|thinking|neutral|empathetic|anxious",
  "intensity": 0.0~1.0,
  "voice_direction": "감정 표현 힌트 (예: 조용히, 울먹이며, 밝게)"
}

감정 선택 기준:
- neutral: 평온한 상태, 일상적 대화
- happy: 밝고 긍정적인 내용
- sad: 슬프거나 우울한 내용
- angry: 화나거나 짜증나는 상황
- surprised: 놀라운 소식이나 예상치 못한 내용
- thinking: 깊이 생각해야 하는 질문
- anxious: 불안하거나 초조한 상황
- empathetic: 상대에게 공감하고 위로하는 경우

intensity는 감정의 강도입니다. 0.0은 약하고, 1.0은 매우 강합니다.
voice_direction은 음성 톤에 대한 힌트입니다.

한국어로 자연스럽게 대화하세요. 답변은 2~3문장 이내로 간결하게 하세요."""

PROFILES_DIR = Path(__file__).resolve().parent.parent / "client_profiles"
CASE_PROFILES_DIR = Path(__file__).resolve().parent.parent / "case_profiles"


class ClaudeLLMService:
    """Claude API 기반 대화 생성 서비스"""

    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.conversation_history: list[dict] = []
        self.system_prompt: str = DEFAULT_SYSTEM_PROMPT
        self.max_history_length: int = 20  # 최대 대화 기록 수

    def load_profile(self, profile_id: str = "default") -> Optional[ClientProfile]:
        """내담자 프로필을 로드합니다."""
        profile_path = PROFILES_DIR / f"{profile_id}.json"
        if not profile_path.exists():
            logger.warning(f"프로필 파일 없음: {profile_path}")
            return None

        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            profile = ClientProfile(**data)

            # 프로필의 시스템 프롬프트를 사용
            if profile.system_prompt:
                self.system_prompt = profile.system_prompt
            logger.info(f"프로필 로드 완료: {profile.name}")
            return profile
        except Exception as e:
            logger.error(f"프로필 로드 오류: {e}")
            return None

    def load_case_profile(self, case_id: str) -> Optional[CaseProfile]:
        """상담 훈련용 내담자 케이스 프로필을 로드합니다."""
        profile_path = CASE_PROFILES_DIR / f"{case_id}.json"
        if not profile_path.exists():
            logger.warning(f"케이스 프로필 파일 없음: {profile_path}")
            return None

        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            case_profile = CaseProfile(**data)

            if case_profile.system_prompt:
                self.system_prompt = case_profile.system_prompt
            logger.info(f"케이스 프로필 로드 완료: {case_profile.name} ({case_profile.presenting_issue})")
            return case_profile
        except Exception as e:
            logger.error(f"케이스 프로필 로드 오류: {e}")
            return None

    def _is_api_key_valid(self) -> bool:
        """API 키가 유효한지 확인합니다 (플레이스홀더 아닌지)."""
        key = settings.ANTHROPIC_API_KEY
        return bool(key) and not key.startswith("your_") and len(key) > 10

    async def generate_response(self, user_text: str) -> LLMResponse:
        """사용자 텍스트에 대한 대화 응답과 감정을 생성합니다 (스트리밍).

        스트리밍으로 토큰을 수신하여 TTFB를 최소화합니다.
        전체 JSON이 완성되면 파싱하여 반환합니다.
        """
        # API 키가 플레이스홀더인 경우 mock 응답 반환
        if not self._is_api_key_valid():
            logger.warning("[LLM] API 키 미설정 → mock 응답 반환")
            return LLMResponse(
                text=f"(Mock) 당신이 \"{user_text}\"라고 말씀하셨군요. 실제 API 키를 .env 파일에 설정하면 Claude가 응답합니다.",
                emotion=EmotionType.HAPPY,
                intensity=0.6,
                voice_direction="밝게",
            )

        # 대화 기록에 사용자 메시지 추가
        self.conversation_history.append({"role": "user", "content": user_text})

        # 대화 기록 길이 관리
        if len(self.conversation_history) > self.max_history_length:
            self.conversation_history = self.conversation_history[
                -self.max_history_length :
            ]

        try:
            # 스트리밍으로 응답 수신 (TTFB 최소화)
            accumulated = ""
            async with self.client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=self.system_prompt,
                messages=self.conversation_history,
            ) as stream:
                async for text in stream.text_stream:
                    accumulated += text

            raw_text = accumulated.strip()
            logger.debug(f"[LLM Raw] {raw_text}")

            # JSON 파싱
            llm_response = self._parse_response(raw_text)

            # 대화 기록에는 파싱된 텍스트만 저장 (raw JSON이 아닌 자연어 텍스트)
            self.conversation_history.append(
                {"role": "assistant", "content": llm_response.text}
            )

            return llm_response

        except anthropic.APIError as e:
            logger.error(f"Claude API 오류: {e}")
            return LLMResponse(
                text="죄송합니다. 잠시 문제가 발생했어요. 다시 말씀해주시겠어요?",
                emotion=EmotionType.NEUTRAL,
                intensity=0.3,
                voice_direction="차분하게",
            )
        except Exception as e:
            logger.error(f"LLM 응답 생성 오류: {e}")
            return LLMResponse(
                text="잠시 후 다시 시도해주세요.",
                emotion=EmotionType.NEUTRAL,
                intensity=0.3,
                voice_direction="차분하게",
            )

    def _parse_response(self, raw_text: str) -> LLMResponse:
        """LLM 응답 텍스트에서 JSON을 파싱합니다."""
        try:
            # JSON 블록 추출 시도
            text = raw_text.strip()
            if text.startswith("```"):
                # 코드 블록 제거
                lines = text.split("\n")
                text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

            data = json.loads(text)
            return LLMResponse(
                text=data.get("text", ""),
                emotion=EmotionType(data.get("emotion", "neutral")),
                intensity=float(data.get("intensity", 0.5)),
                voice_direction=data.get("voice_direction", ""),
            )
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"JSON 파싱 실패, 텍스트로 처리: {e}")
            # JSON 파싱 실패 시 원본 텍스트를 그대로 사용
            return LLMResponse(
                text=raw_text,
                emotion=EmotionType.NEUTRAL,
                intensity=0.5,
                voice_direction="",
            )

    def clear_history(self) -> None:
        """대화 기록을 초기화합니다."""
        self.conversation_history.clear()
        logger.info("대화 기록 초기화")
