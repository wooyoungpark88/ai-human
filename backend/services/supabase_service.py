"""Supabase 데이터베이스 서비스 - 프로필 로드 및 대화 기록 저장"""

import logging
from typing import Optional
from backend.config import settings
from backend.models.schemas import ClientProfile

logger = logging.getLogger(__name__)

# Supabase 클라이언트 (지연 초기화)
_supabase_client = None


def _get_client():
    """Supabase 클라이언트를 반환합니다 (지연 초기화)."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None

    if settings.SUPABASE_URL.startswith("your_"):
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
        logger.info("Supabase 클라이언트 초기화 완료")
        return _supabase_client
    except Exception as e:
        logger.warning(f"Supabase 클라이언트 초기화 실패: {e}")
        return None


def is_available() -> bool:
    """Supabase가 사용 가능한지 확인합니다."""
    return _get_client() is not None


def load_profile(profile_id: str) -> Optional[ClientProfile]:
    """Supabase에서 AI 프로필을 로드합니다."""
    client = _get_client()
    if not client:
        return None

    try:
        result = client.table("ai_profiles").select("*").eq("id", profile_id).single().execute()
        if result.data:
            return ClientProfile(**result.data)
        return None
    except Exception as e:
        logger.warning(f"Supabase 프로필 로드 실패 ({profile_id}): {e}")
        return None


def list_profiles() -> list[dict]:
    """Supabase에서 공개 AI 프로필 목록을 조회합니다."""
    client = _get_client()
    if not client:
        return []

    try:
        result = (
            client.table("ai_profiles")
            .select("id, name, description")
            .eq("is_public", True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning(f"Supabase 프로필 목록 조회 실패: {e}")
        return []


def create_conversation(user_id: str, profile_id: str) -> Optional[str]:
    """새 대화 세션을 생성하고 ID를 반환합니다."""
    client = _get_client()
    if not client:
        return None

    try:
        result = (
            client.table("conversations")
            .insert({"user_id": user_id, "profile_id": profile_id})
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
        return None
    except Exception as e:
        logger.warning(f"대화 세션 생성 실패: {e}")
        return None


def save_message(
    conversation_id: str,
    role: str,
    content: str,
    emotion: Optional[str] = None,
    intensity: Optional[float] = None,
) -> None:
    """메시지를 데이터베이스에 저장합니다."""
    client = _get_client()
    if not client or not conversation_id:
        return

    try:
        data = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
        }
        if emotion:
            data["emotion"] = emotion
        if intensity is not None:
            data["intensity"] = intensity

        client.table("messages").insert(data).execute()
    except Exception as e:
        logger.warning(f"메시지 저장 실패: {e}")


def end_conversation(conversation_id: str) -> None:
    """대화 세션을 종료합니다."""
    client = _get_client()
    if not client or not conversation_id:
        return

    try:
        from datetime import datetime, timezone
        client.table("conversations").update(
            {"ended_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", conversation_id).execute()
    except Exception as e:
        logger.warning(f"대화 세션 종료 업데이트 실패: {e}")
