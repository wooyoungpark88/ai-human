"""상담 수행 평가 피드백 서비스 — Claude를 수퍼바이저로 활용"""

import json
import logging
from typing import Optional

import anthropic

from backend.config import settings
from backend.models.schemas import SessionFeedback, FeedbackCategory

logger = logging.getLogger(__name__)

FEEDBACK_SYSTEM_PROMPT = """당신은 상담심리 수퍼바이저입니다. 훈련생(상담사)의 상담 수행을 아래 기준으로 평가하세요.

## 평가 항목 (각 0~100점)

1. **empathy** (공감 표현): 내담자의 감정을 인식하고 적절히 반영했는가
2. **active_listening** (적극적 경청): 내담자의 말을 주의 깊게 듣고 이해를 보여주었는가
3. **questioning** (질문 기법): 개방형 질문을 적절히 사용했는가 (폐쇄형 질문 과다 시 감점)
4. **emotion_reflection** (감정 반영): 내담자의 감정을 명명하고 반영했는가
5. **boundaries** (경계 설정): 성급한 조언이나 판단을 자제하고 전문적 경계를 유지했는가
6. **summarization** (요약 및 구조화): 대화 내용을 적절히 정리하고 구조화했는가

## 점수 기준
- 90~100: 매우 우수 — 숙련된 상담사 수준
- 70~89: 우수 — 적절한 상담 기법 사용
- 50~69: 보통 — 기본적 대화는 가능하나 개선 필요
- 30~49: 미흡 — 상담 기법 학습 필요
- 0~29: 부족 — 기본적 상담 태도 개선 필요

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요:
{
  "overall_score": 종합점수(0~100),
  "categories": [
    {"name": "공감 표현", "name_en": "empathy", "score": 점수, "comment": "구체적 피드백"},
    {"name": "적극적 경청", "name_en": "active_listening", "score": 점수, "comment": "구체적 피드백"},
    {"name": "질문 기법", "name_en": "questioning", "score": 점수, "comment": "구체적 피드백"},
    {"name": "감정 반영", "name_en": "emotion_reflection", "score": 점수, "comment": "구체적 피드백"},
    {"name": "경계 설정", "name_en": "boundaries", "score": 점수, "comment": "구체적 피드백"},
    {"name": "요약 및 구조화", "name_en": "summarization", "score": 점수, "comment": "구체적 피드백"}
  ],
  "summary": "종합 피드백 (3~5문장, 전체적 인상과 핵심 개선 방향)",
  "strengths": ["잘한 점 1", "잘한 점 2", ...],
  "improvements": ["개선할 점 1", "개선할 점 2", ...],
  "recommendations": ["추천 학습/연습 1", "추천 학습/연습 2", ...]
}"""


class FeedbackService:
    """Claude API를 사용하여 상담 수행 피드백을 생성합니다."""

    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def generate_feedback(
        self,
        case_id: str,
        case_info: dict,
        messages: list[dict],
    ) -> SessionFeedback:
        """상담 대화를 분석하여 피드백을 생성합니다."""

        # 대화 기록 포맷팅
        conversation_text = self._format_conversation(messages)

        # 케이스 컨텍스트
        case_context = self._format_case_context(case_info)

        user_prompt = f"""다음은 상담 훈련 세션의 기록입니다. 훈련생(상담사)의 수행을 평가해주세요.

## 내담자 정보
{case_context}

## 상담 대화 기록
{conversation_text}

위 대화를 분석하여 JSON 형식으로 평가해주세요."""

        try:
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=FEEDBACK_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw_text = response.content[0].text.strip()
            return self._parse_feedback(raw_text, case_id)

        except Exception as e:
            logger.error(f"피드백 생성 오류: {e}")
            return self._fallback_feedback(case_id, str(e))

    def _format_conversation(self, messages: list[dict]) -> str:
        lines = []
        for msg in messages:
            role_label = "상담사" if msg["role"] == "user" else "내담자"
            lines.append(f"[{role_label}] {msg['text']}")
        return "\n".join(lines)

    def _format_case_context(self, case_info: dict) -> str:
        if not case_info:
            return "(케이스 정보 없음)"
        parts = []
        if case_info.get("name"):
            parts.append(f"- 이름: {case_info['name']}")
        if case_info.get("age"):
            parts.append(f"- 나이: {case_info['age']}세")
        if case_info.get("gender"):
            parts.append(f"- 성별: {case_info['gender']}")
        if case_info.get("occupation"):
            parts.append(f"- 직업: {case_info['occupation']}")
        if case_info.get("presenting_issue"):
            parts.append(f"- 호소 문제: {case_info['presenting_issue']}")
        if case_info.get("session_goals"):
            parts.append(f"- 세션 목표: {', '.join(case_info['session_goals'])}")
        return "\n".join(parts) if parts else "(케이스 정보 없음)"

    def _parse_feedback(self, raw_text: str, case_id: str) -> SessionFeedback:
        try:
            text = raw_text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

            data = json.loads(text)
            categories = [
                FeedbackCategory(**cat) for cat in data.get("categories", [])
            ]
            return SessionFeedback(
                case_id=case_id,
                overall_score=float(data.get("overall_score", 50)),
                categories=categories,
                summary=data.get("summary", ""),
                strengths=data.get("strengths", []),
                improvements=data.get("improvements", []),
                recommendations=data.get("recommendations", []),
            )
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"피드백 JSON 파싱 실패: {e}")
            return self._fallback_feedback(case_id, f"파싱 오류: {e}")

    def _fallback_feedback(self, case_id: str, error_msg: str) -> SessionFeedback:
        return SessionFeedback(
            case_id=case_id,
            overall_score=0,
            categories=[],
            summary=f"피드백 생성에 실패했습니다: {error_msg}",
            strengths=[],
            improvements=[],
            recommendations=["다시 시도해주세요."],
        )
