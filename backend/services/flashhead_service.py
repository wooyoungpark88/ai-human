"""FlashHead 사이드카 클라이언트 — OpenAvatarChat 기반 로컬 아바타 엔진 연동

사이드카(별도 프로세스)가 로컬 GPU(FlashHead)에서 오디오 → 립싱크 비디오를 생성합니다.
본 모듈은 백엔드에서 사이드카로 세션을 열고 WebRTC 핸드셰이크를 중계합니다.

프로토콜 요약 (자세한 사양: docs/flashhead-sidecar-protocol.md):
  POST /session        → { session_id, webrtc_offer_sdp }
  POST /session/{id}/answer  (body: sdp)
  POST /session/{id}/audio   (body: raw pcm_16k bytes)  — 또는 WS /session/{id}/audio
  DELETE /session/{id}

사이드카 URL이 미설정(FLASHHEAD_SIDECAR_URL="")이면 `is_available()`이 False를 반환하고,
상위 레이어에서 Simli/VRM으로 fallback해야 합니다.
"""

import logging
from typing import Optional

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)


class FlashHeadSidecarClient:
    """FlashHead 사이드카 HTTP 클라이언트 (stub)

    현재는 스켈레톤 — 실제 구현은 사이드카 동작 검증 후 채웁니다.
    """

    def __init__(self, base_url: Optional[str] = None, timeout_s: float = 10.0) -> None:
        self.base_url = (base_url or settings.FLASHHEAD_SIDECAR_URL).rstrip("/")
        self.timeout_s = timeout_s
        self._client: Optional[httpx.AsyncClient] = None

    def is_available(self) -> bool:
        """사이드카 URL 설정 여부만 확인 (헬스체크는 별도)."""
        return bool(self.base_url)

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url, timeout=self.timeout_s
            )
        return self._client

    async def healthcheck(self) -> bool:
        """사이드카 `/health` 엔드포인트 확인."""
        if not self.is_available():
            return False
        try:
            client = await self._ensure_client()
            resp = await client.get("/health")
            return resp.status_code == 200
        except httpx.HTTPError as e:
            logger.warning(f"[FlashHead] healthcheck 실패: {e}")
            return False

    async def create_session(
        self, model_id: str, client_sdp: str
    ) -> Optional[dict]:
        """새 WebRTC 세션 생성. 사이드카가 FlashHead 모델을 로드하고 answer SDP를 반환합니다.

        Args:
            model_id: 케이스 프로필의 `flashhead_model_id` (사이드카에서 학습된 모델 식별자)
            client_sdp: 프론트가 생성한 WebRTC offer SDP

        Returns:
            {"session_id": str, "answer_sdp": str} | None (실패 시)
        """
        if not self.is_available():
            return None
        try:
            client = await self._ensure_client()
            resp = await client.post(
                "/session",
                json={"model_id": model_id, "offer_sdp": client_sdp},
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            logger.error(f"[FlashHead] create_session 실패: {e}")
            return None

    async def push_audio(self, session_id: str, pcm_bytes: bytes) -> bool:
        """PCM16 오디오 청크를 사이드카에 전달. 사이드카가 WebRTC 비디오 트랙으로 스트리밍합니다.

        저지연을 위해 WebSocket으로 승격할 수 있으나, 초기 구현은 HTTP POST로 충분합니다.
        """
        if not self.is_available():
            return False
        try:
            client = await self._ensure_client()
            resp = await client.post(
                f"/session/{session_id}/audio",
                content=pcm_bytes,
                headers={"Content-Type": "application/octet-stream"},
            )
            return resp.status_code == 202
        except httpx.HTTPError as e:
            logger.warning(f"[FlashHead] push_audio 실패: {e}")
            return False

    async def close_session(self, session_id: str) -> None:
        if not self.is_available() or not session_id:
            return
        try:
            client = await self._ensure_client()
            await client.delete(f"/session/{session_id}")
        except httpx.HTTPError as e:
            logger.warning(f"[FlashHead] close_session 실패: {e}")

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
