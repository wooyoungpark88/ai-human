"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationPhase, EmotionType } from "@/lib/types";
import { API_URL } from "@/lib/constants";

interface UseHeyGenAvatarOptions {
  /** HeyGen 아바타 ID (e.g. "June_HR_public", "Tyler-incasualsuit-20220721"). 비우면 서버 기본값 사용 */
  avatarName?: string;
  /** 음성 언어 (ISO) */
  language?: string;
}

/**
 * HeyGen Interactive Avatar (Streaming) 훅
 *
 *  1. backend GET /api/heygen/token → access token (서버가 x-api-key로 발급)
 *  2. new StreamingAvatar({ token })
 *  3. createStartAvatar({ avatarName, voice, language }) → STREAM_READY 이벤트로 MediaStream 수신
 *  4. avatar.speak({ text, taskType: REPEAT }) — HeyGen 자체 TTS+립싱크
 *
 * AVATAR_START_TALKING / AVATAR_STOP_TALKING 이벤트로 발화 상태 추적.
 *
 * NOTE: @heygen/streaming-avatar 패키지가 설치되지 않은 경우 동적 임포트 실패 → 데모 모드.
 *       npm install @heygen/streaming-avatar 후 활성화.
 */
export function useHeyGenAvatar(options: UseHeyGenAvatarOptions = {}) {
  const { avatarName, language = "ko" } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // SDK 인스턴스 — 패키지 임포트 후에야 타입 사용 가능. 느슨한 타입으로 보관.
  const avatarRef = useRef<{
    createStartAvatar: (opts: Record<string, unknown>) => Promise<{ session_id: string }>;
    speak: (opts: { text: string; taskType?: unknown; taskMode?: unknown }) => Promise<void>;
    stopSpeak?: () => Promise<void>;
    interrupt?: () => Promise<void>;
    stopAvatar: () => Promise<void>;
    on: (event: string, listener: (e: { detail: unknown }) => void) => void;
  } | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. token 발급
      const tokRes = await fetch(`${API_URL}/api/heygen/token`);
      const tokData = (await tokRes.json()) as
        | { token: string; default_avatar: string }
        | { error: string };
      if ("error" in tokData) {
        throw new Error(`token 발급 실패: ${tokData.error}`);
      }
      const accessToken = tokData.token;
      const resolvedAvatar = avatarName || tokData.default_avatar;

      // 2. SDK 임포트 (패키지 미설치 시 데모 모드)
      let mod;
      try {
        mod = await import(
          /* @vite-ignore */ /* webpackIgnore: true */ "@heygen/streaming-avatar"
        );
      } catch {
        console.warn(
          "[HeyGenAvatar] @heygen/streaming-avatar 미설치 — 데모 모드 (npm install @heygen/streaming-avatar)"
        );
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      const StreamingAvatar = (mod as { default?: unknown }).default || (mod as { StreamingAvatar?: unknown }).StreamingAvatar;
      const StreamingEvents = (mod as { StreamingEvents?: Record<string, string> }).StreamingEvents;
      const TaskType = (mod as { TaskType?: Record<string, string> }).TaskType;
      const AvatarQuality = (mod as { AvatarQuality?: Record<string, string> }).AvatarQuality;

      if (!StreamingAvatar || !StreamingEvents || !TaskType) {
        throw new Error("@heygen/streaming-avatar exports 누락 — 패키지 버전 확인");
      }

      // 3. SDK 인스턴스 생성
      const Ctor = StreamingAvatar as new (opts: { token: string }) => typeof avatarRef.current;
      const avatar = new Ctor({ token: accessToken });
      avatarRef.current = avatar;

      // 4. 이벤트 핸들러
      avatar?.on(StreamingEvents.STREAM_READY, (event) => {
        const stream = event.detail as MediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.dataset.hasStream = "true";
          console.log("[HeyGenAvatar] 비디오 스트림 연결됨");
        }
      });
      avatar?.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("[HeyGenAvatar] 스트림 연결 해제");
        if (videoRef.current) {
          videoRef.current.dataset.hasStream = "false";
        }
      });
      avatar?.on(StreamingEvents.AVATAR_START_TALKING, () => {
        videoRef.current?.setAttribute("data-talking", "true");
      });
      avatar?.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        videoRef.current?.setAttribute("data-talking", "false");
      });

      // 5. 세션 시작
      await avatar?.createStartAvatar({
        quality: AvatarQuality?.Low ?? "low",
        avatarName: resolvedAvatar,
        language,
      });

      // taskType은 outer scope에서 speak 시 사용하기 위해 ref와 함께 저장 — 여기선 SDK 모듈을 클로저로 캡쳐
      // 사용 패턴: speakText 내부에서 import 다시 — 단일 진입점으로 단순화 위해 모듈 ref 보관
      sdkModuleRef.current = mod;

      setIsInitialized(true);
      setIsLoading(false);
      console.log(
        `[HeyGenAvatar] 초기화 완료 — avatar: ${resolvedAvatar}, lang: ${language}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "HeyGen 아바타 초기화 실패";
      setError(message);
      setIsLoading(false);
      console.error("[HeyGenAvatar] 초기화 오류:", err);
    }
  }, [avatarName, language]);

  // SDK 모듈 ref (speak 시 TaskType enum 접근용)
  const sdkModuleRef = useRef<unknown>(null);

  const speakText = useCallback(async (text: string) => {
    const avatar = avatarRef.current;
    const mod = sdkModuleRef.current as {
      TaskType?: Record<string, string>;
      TaskMode?: Record<string, string>;
    } | null;
    if (!avatar || !mod?.TaskType) return;
    try {
      await avatar.speak({
        text,
        taskType: mod.TaskType.REPEAT,
        taskMode: mod.TaskMode?.SYNC,
      });
    } catch (err) {
      console.warn("[HeyGenAvatar] speak 오류:", err);
    }
  }, []);

  const sendBase64Audio = useCallback((_base64Audio: string) => {
    // HeyGen은 자체 TTS — 외부 오디오 주입 불필요 (no-op)
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // HeyGen은 voice.emotion 옵션이 있지만 speak 단위로만 적용. 단순화 위해 no-op.
    },
    []
  );

  const setConversationPhase = useCallback(
    (_phase: ConversationPhase) => {
      // HeyGen SDK는 자체 talking 상태 머신 사용
    },
    []
  );

  const close = useCallback(async () => {
    const avatar = avatarRef.current;
    if (avatar) {
      try {
        await avatar.stopAvatar();
      } catch (err) {
        console.warn("[HeyGenAvatar] stopAvatar 오류:", err);
      }
    }
    avatarRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.dataset.hasStream = "false";
    }
    setIsInitialized(false);
    console.log("[HeyGenAvatar] 세션 종료");
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
  };
}
