"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationPhase, EmotionType } from "@/lib/types";

const FLASHHEAD_SIDECAR_URL =
  process.env.NEXT_PUBLIC_FLASHHEAD_SIDECAR_URL || "";

interface UseFlashHeadAvatarOptions {
  modelId?: string;
}

/**
 * FlashHead 아바타 훅 (OpenAvatarChat 기반 로컬 사이드카)
 *
 * 동작 흐름:
 *  1. RTCPeerConnection 생성 → offer SDP
 *  2. POST {sidecar}/session { model_id, offer_sdp } → { session_id, answer_sdp }
 *  3. 비디오 트랙 수신 후 videoRef에 연결
 *  4. sendBase64Audio()로 PCM16 청크를 사이드카에 POST (또는 WS 승격)
 *
 * 프로토콜: docs/flashhead-sidecar-protocol.md
 *
 * 현재는 스켈레톤 — 사이드카 구현이 준비되면 initialize() 본문을 완성합니다.
 * useSimliAvatar와 동일한 인터페이스를 노출합니다.
 */
export function useFlashHeadAvatar(options: UseFlashHeadAvatarOptions = {}) {
  const { modelId } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!FLASHHEAD_SIDECAR_URL) {
        console.warn("[FlashHead] sidecar URL 미설정 — 데모 모드");
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      if (!modelId) {
        throw new Error("flashhead_model_id가 설정되지 않았습니다");
      }
      if (!videoRef.current || !audioRef.current) {
        throw new Error("video/audio 엘리먼트가 마운트되지 않았습니다");
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerRef.current = pc;

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (event.track.kind === "video" && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.dataset.hasStream = "true";
        }
      };

      pc.addTransceiver("video", { direction: "recvonly" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const resp = await fetch(`${FLASHHEAD_SIDECAR_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: modelId,
          offer_sdp: offer.sdp,
        }),
      });
      if (!resp.ok) {
        throw new Error(`sidecar session 생성 실패: ${resp.status}`);
      }
      const { session_id, answer_sdp } = (await resp.json()) as {
        session_id: string;
        answer_sdp: string;
      };
      sessionIdRef.current = session_id;

      await pc.setRemoteDescription({ type: "answer", sdp: answer_sdp });

      setIsInitialized(true);
      setIsLoading(false);
      console.log("[FlashHead] 초기화 완료", { sessionId: session_id });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "FlashHead 아바타 초기화 실패";
      setError(message);
      setIsLoading(false);
      console.error("[FlashHead] 초기화 오류:", err);
    }
  }, [modelId]);

  const sendBase64Audio = useCallback(async (base64Audio: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !FLASHHEAD_SIDECAR_URL) return;
    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await fetch(
        `${FLASHHEAD_SIDECAR_URL}/session/${sessionId}/audio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: bytes,
        }
      );
    } catch (err) {
      console.warn("[FlashHead] 오디오 전송 오류:", err);
    }
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // FlashHead는 오디오 프로소디 기반 표정 생성 — 별도 감정 API 없음
      // 향후 사이드카에 POST /session/{id}/emotion 추가 시 연결
    },
    []
  );

  const setConversationPhase = useCallback((_phase: ConversationPhase) => {
    // 필요 시 사이드카에 상태 신호 전달
  }, []);

  const close = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (sessionId && FLASHHEAD_SIDECAR_URL) {
      fetch(`${FLASHHEAD_SIDECAR_URL}/session/${sessionId}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.dataset.hasStream = "false";
    }
    sessionIdRef.current = null;
    setIsInitialized(false);
  }, []);

  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    sendBase64Audio,
    setEmotion,
    setConversationPhase,
    close,
    videoRef,
    audioRef,
  };
}
