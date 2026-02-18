"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationPhase, EmotionType } from "@/lib/types";

const SIMLI_API_KEY = process.env.NEXT_PUBLIC_SIMLI_API_KEY || "";

interface UseSimliAvatarOptions {
  faceId?: string;
}

/**
 * Simli WebRTC 아바타 훅
 *
 * Simli는 오디오→립싱크 비디오 변환 서비스:
 * 1. generateSimliSessionToken()으로 세션 토큰 발급
 * 2. SimliClient로 WebRTC 연결
 * 3. PCM16 오디오를 sendAudioData()로 전송 → 립싱크 비디오 수신
 *
 * useVRMAvatar / useVideoAvatar와 동일한 인터페이스 노출.
 */
export function useSimliAvatar(options: UseSimliAvatarOptions = {}) {
  const { faceId } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simliClientRef = useRef<import("simli-client").SimliClient | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // API 키 확인
      if (!SIMLI_API_KEY) {
        console.warn("[SimliAvatar] SIMLI_API_KEY 미설정 -- 데모 모드");
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      const resolvedFaceId = faceId || process.env.NEXT_PUBLIC_SIMLI_FACE_ID || "";
      if (!resolvedFaceId) {
        throw new Error("Simli face_id가 설정되지 않았습니다");
      }

      console.log("[SimliAvatar] Simli 세션 생성 중...", { faceId: resolvedFaceId });

      // simli-client 동적 임포트 (SSR 방지)
      const { SimliClient, generateSimliSessionToken } =
        await import("simli-client");

      // 1. 세션 토큰 발급
      const tokenData = await generateSimliSessionToken(
        {
          config: {
            faceId: resolvedFaceId,
            handleSilence: true,
            maxSessionLength: 3600,
            maxIdleTime: 600,
          },
          apiKey: SIMLI_API_KEY,
        },
        "https://api.simli.ai"
      );

      console.log("[SimliAvatar] 세션 토큰 발급 완료");

      // 2. video/audio 엘리먼트 확인
      if (!videoRef.current || !audioRef.current) {
        throw new Error("Simli video/audio 엘리먼트가 마운트되지 않았습니다");
      }

      // 3. SimliClient 생성 (LiveKit 모드 — P2P는 기업 방화벽에서 타임아웃 발생)
      const client = new SimliClient(
        tokenData.session_token,
        videoRef.current,
        audioRef.current,
        null,       // iceServers (LiveKit 모드에서 불필요)
        undefined,  // logLevel (기본값)
        "livekit",  // transport_mode — P2P 타임아웃 회피
      );

      simliClientRef.current = client;

      client.on("start", () => {
        console.log("[SimliAvatar] Simli 연결됨");
        if (videoRef.current) {
          videoRef.current.dataset.hasStream = "true";
        }
      });

      client.on("error", (detail: string) => {
        console.error("[SimliAvatar] Simli 오류:", detail);
      });

      client.on("stop", () => {
        console.log("[SimliAvatar] Simli 세션 종료");
        if (videoRef.current) {
          videoRef.current.dataset.hasStream = "false";
        }
      });

      await client.start();

      // 초기 침묵 전송 (아바타 웜업)
      const silence = new Uint8Array(6000).fill(0);
      client.sendAudioData(silence);

      setIsInitialized(true);
      setIsLoading(false);
      console.log("[SimliAvatar] 초기화 완료 -- Simli 연결됨");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Simli 아바타 초기화 실패";
      setError(message);
      setIsLoading(false);
      console.error("[SimliAvatar] 초기화 오류:", err);
    }
  }, [faceId]);

  const sendBase64Audio = useCallback((base64Audio: string) => {
    // Simli에 PCM16 오디오 전달 (Simli가 <audio> 엘리먼트로 오디오 반환 재생)
    const client = simliClientRef.current;
    if (client) {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        client.sendAudioData(bytes);
      } catch (err) {
        console.warn("[SimliAvatar] 오디오 전송 오류:", err);
      }
    }
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // Simli는 오디오 프로소디 기반 립싱크 — 별도 감정 API 없음
    },
    []
  );

  const setConversationPhase = useCallback(
    (_phase: ConversationPhase) => {
      // Simli는 오디오 기반 립싱크 중심이라 별도 모션 상태를 사용하지 않음
    },
    []
  );

  const close = useCallback(() => {
    if (simliClientRef.current) {
      simliClientRef.current.stop();
      simliClientRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.dataset.hasStream = "false";
    }

    setIsInitialized(false);
    console.log("[SimliAvatar] 세션 종료");
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
