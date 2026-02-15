"""Deepgram 실시간 스트리밍 STT 서비스"""

import asyncio
import logging
from typing import AsyncGenerator

from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

from backend.config import settings

logger = logging.getLogger(__name__)


class DeepgramSTTService:
    """Deepgram WebSocket 기반 실시간 음성-텍스트 변환 서비스"""

    def __init__(self):
        self.connection = None
        self.transcript_queue: asyncio.Queue[dict] = asyncio.Queue()
        self._is_connected = False

    async def connect(self) -> bool:
        """Deepgram 실시간 연결을 시작합니다. 성공 시 True 반환."""
        api_key = settings.DEEPGRAM_API_KEY
        if not api_key or api_key.startswith("your_"):
            logger.warning("[STT] Deepgram API 키가 설정되지 않았습니다. STT 비활성화.")
            return False

        logger.info(f"[STT] Deepgram 연결 시도 (API key: {api_key[:8]}...{api_key[-4:]})")

        try:
            config = DeepgramClientOptions(
                api_key=api_key,
                options={"keepalive": "true"},
            )
            client = DeepgramClient(api_key, config)
            self.connection = client.listen.asyncwebsocket.v("1")

            # 이벤트 핸들러 등록
            self.connection.on(
                LiveTranscriptionEvents.Transcript, self._on_transcript
            )
            self.connection.on(
                LiveTranscriptionEvents.UtteranceEnd, self._on_utterance_end
            )
            self.connection.on(LiveTranscriptionEvents.Error, self._on_error)
            self.connection.on(LiveTranscriptionEvents.Close, self._on_close)

            # 연결 옵션 설정
            options = LiveOptions(
                model="nova-2",
                language="ko",
                encoding="linear16",
                sample_rate=16000,
                channels=1,
                punctuate=True,
                interim_results=True,
                utterance_end_ms=1500,
                vad_events=True,
                endpointing=300,
            )

            result = await self.connection.start(options)
            if result:
                self._is_connected = True
                logger.info("[STT] Deepgram 연결 성공")
                return True
            else:
                logger.error("[STT] Deepgram 연결 실패 (start() returned False)")
                return False

        except Exception as e:
            logger.error(f"[STT] Deepgram 연결 오류: {type(e).__name__}: {e}")
            return False

    async def send_audio(self, audio_data: bytes) -> None:
        """오디오 데이터를 Deepgram에 전송합니다."""
        if self.connection and self._is_connected:
            try:
                await self.connection.send(audio_data)
            except Exception as e:
                logger.error(f"[STT] 오디오 전송 오류: {type(e).__name__}: {e}")
                self._is_connected = False

    async def get_transcripts(self) -> AsyncGenerator[dict, None]:
        """트랜스크립트 이벤트를 비동기적으로 수신합니다."""
        while self._is_connected:
            try:
                transcript = await asyncio.wait_for(
                    self.transcript_queue.get(), timeout=0.1
                )
                yield transcript
            except asyncio.TimeoutError:
                continue
            except Exception:
                break

    async def disconnect(self) -> None:
        """Deepgram 연결을 종료합니다."""
        self._is_connected = False
        if self.connection:
            try:
                await self.connection.finish()
            except Exception as e:
                logger.warning(f"[STT] 연결 종료 중 오류: {e}")
            self.connection = None
        logger.info("[STT] Deepgram 연결 종료")

    # --- 이벤트 핸들러 ---

    async def _on_transcript(self, _client, result, **kwargs) -> None:
        """트랜스크립트 수신 이벤트"""
        try:
            sentence = result.channel.alternatives[0].transcript
            if not sentence:
                return

            is_final = result.is_final
            await self.transcript_queue.put(
                {
                    "type": "transcript",
                    "text": sentence,
                    "is_final": is_final,
                }
            )

            if is_final:
                logger.info(f"[STT Final] {sentence}")
            else:
                logger.info(f"[STT Partial] {sentence}")

        except Exception as e:
            logger.error(f"[STT] 트랜스크립트 처리 오류: {e}")

    async def _on_utterance_end(self, _client, result, **kwargs) -> None:
        """발화 종료 이벤트 - LLM 호출 트리거"""
        await self.transcript_queue.put(
            {
                "type": "utterance_end",
                "text": "",
                "is_final": True,
            }
        )
        logger.info("[STT] 발화 종료 감지")

    async def _on_error(self, _client, error, **kwargs) -> None:
        """오류 이벤트"""
        logger.error(f"[STT] Deepgram 오류: {error}")

    async def _on_close(self, _client, close, **kwargs) -> None:
        """연결 종료 이벤트"""
        self._is_connected = False
        logger.info("[STT] Deepgram 연결이 닫혔습니다")

    @property
    def is_connected(self) -> bool:
        return self._is_connected
