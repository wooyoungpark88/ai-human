"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationPhase, EmotionType } from "@/lib/types";
import { API_URL } from "@/lib/constants";

const SDK_SCRIPT_SRC = "/sdk/aiPlayer-1.6.2.min.js";

interface UseDeepBrainAvatarOptions {
  /** 사용할 AI 캐릭터 이름 (DeepBrain 콘솔의 ai_name). 비우면 발급된 token의 defaultAI 사용 */
  aiName?: string;
}

// AIPlayer SDK는 글로벌 스크립트로 로드되어 window에 AIPlayer/AIEventType 등을 등록함
type AIPlayerInstance = {
  init: (config: {
    aiName: string;
    size?: number;
    left?: number;
    top?: number;
    speed?: number;
  }) => Promise<void>;
  generateToken: (args: { appId: string; token: string }) => Promise<{
    succeed: boolean;
    token?: string;
    tokenExpire?: number;
    defaultAI?: { ai_name: string };
    error?: string;
  }>;
  send: (text: string) => void;
  stop?: () => void;
  release?: () => void;
  destroy?: () => void;
  getState?: () => number;
  onAIPlayerEvent?: (event: { type: number }) => void;
  onAIPlayerErrorV2?: (error: { code: number; message: string }) => void;
  onAIPlayerLoadingProgressed?: (result: { loading: number }) => void;
};

declare global {
  interface Window {
    AIPlayer?: new (wrapper: HTMLElement) => AIPlayerInstance;
    AIEventType?: Record<string, number>;
  }
}

let sdkLoadPromise: Promise<void> | null = null;
function loadSDK(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DeepBrain SDK는 브라우저에서만 로드 가능"));
  }
  if (window.AIPlayer) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("aiPlayer SDK 스크립트 로드 실패"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("aiPlayer SDK 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

/**
 * DeepBrain AI Human Web SDK 아바타 훅
 *
 *  1. /sdk/aiPlayer-1.6.2.min.js 동적 로드 → window.AIPlayer 사용 가능
 *  2. backend GET /api/deepbrain/jwt → { appId, token } (server-signed JWT)
 *  3. AIPlayer.generateToken({appId, token}) → verifiedToken + defaultAI
 *  4. AIPlayer.init({ aiName, size, left, top, speed }) → 컨테이너에 아바타 마운트
 *  5. speakText(text) → AIPlayer.send(text) — SDK가 자체 TTS+립싱크
 *
 *  AICLIPSET_PLAY_STARTED/COMPLETED 이벤트로 isSpeaking 상태 추적.
 */
export function useDeepBrainAvatar(options: UseDeepBrainAvatarOptions = {}) {
  const { aiName } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<AIPlayerInstance | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!containerRef.current) {
        throw new Error("DeepBrain container 엘리먼트가 마운트되지 않았습니다");
      }

      await loadSDK();
      if (!window.AIPlayer) {
        throw new Error("AIPlayer 글로벌이 로드되지 않았습니다");
      }

      // 1. backend에서 JWT 발급
      const jwtRes = await fetch(`${API_URL}/api/deepbrain/jwt`);
      const jwtData = (await jwtRes.json()) as
        | { appId: string; token: string }
        | { error: string };
      if ("error" in jwtData) {
        throw new Error(`JWT 발급 실패: ${jwtData.error}`);
      }

      // 2. AIPlayer 인스턴스 생성 + token 검증
      const player = new window.AIPlayer(containerRef.current);
      playerRef.current = player;

      const tokenResult = await player.generateToken({
        appId: jwtData.appId,
        token: jwtData.token,
      });
      if (!tokenResult?.succeed) {
        throw new Error(
          `generateToken 실패: ${tokenResult?.error || "unknown"}`
        );
      }

      // 3. AIPlayer 이벤트 핸들러 — speak 상태 추적용
      player.onAIPlayerEvent = (aiEvent) => {
        if (!window.AIEventType) return;
        const t = aiEvent.type;
        if (t === window.AIEventType.AICLIPSET_PLAY_STARTED) {
          containerRef.current?.setAttribute("data-speaking", "true");
        } else if (
          t === window.AIEventType.AICLIPSET_PLAY_COMPLETED ||
          t === window.AIEventType.AICLIPSET_PLAY_QUEUE_EMPTY
        ) {
          containerRef.current?.setAttribute("data-speaking", "false");
        }
      };
      player.onAIPlayerErrorV2 = (aiError) => {
        console.warn("[DeepBrainAvatar] AI error:", aiError.code, aiError.message);
      };

      // 4. 아바타 초기화 (aiName 미지정 시 defaultAI 사용)
      const resolvedAiName = aiName || tokenResult.defaultAI?.ai_name;
      if (!resolvedAiName) {
        throw new Error("aiName 또는 defaultAI가 없습니다");
      }
      await player.init({
        aiName: resolvedAiName,
        size: 1.0,
        left: 0,
        top: 0,
        speed: 1.0,
      });

      setIsInitialized(true);
      setIsLoading(false);
      console.log(
        `[DeepBrainAvatar] 초기화 완료 — aiName: ${resolvedAiName}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "DeepBrain 아바타 초기화 실패";
      setError(message);
      setIsLoading(false);
      console.error("[DeepBrainAvatar] 초기화 오류:", err);
    }
  }, [aiName]);

  const speakText = useCallback((text: string) => {
    playerRef.current?.send(text);
  }, []);

  const sendBase64Audio = useCallback((_base64Audio: string) => {
    // DeepBrain은 자체 TTS — 외부 오디오 주입 불필요 (no-op)
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // DeepBrain은 SDK 내부에서 톤 기반 표정 처리 — 별도 감정 API 없음
    },
    []
  );

  const setConversationPhase = useCallback(
    (_phase: ConversationPhase) => {
      // DeepBrain SDK는 send/stop으로 상태 관리 — 별도 phase 신호 불필요
    },
    []
  );

  const close = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      try {
        player.stop?.();
        player.release?.();
        player.destroy?.();
      } catch (err) {
        console.warn("[DeepBrainAvatar] close 중 오류:", err);
      }
    }
    playerRef.current = null;
    setIsInitialized(false);
    console.log("[DeepBrainAvatar] 세션 종료");
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
    speakText,
    setEmotion,
    setConversationPhase,
    close,
    videoRef,
    audioRef,
    containerRef,
  };
}
