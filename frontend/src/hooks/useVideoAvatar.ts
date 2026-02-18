"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationPhase, EmotionType } from "@/lib/types";

const BP_API_URL =
  process.env.NEXT_PUBLIC_BEYOND_PRESENCE_API_URL ||
  "https://api.bey.dev/v1";
const BP_API_KEY = process.env.NEXT_PUBLIC_BEYOND_PRESENCE_API_KEY || "";

interface UseVideoAvatarOptions {
  agentId?: string;
}

/**
 * Beyond Presence Managed Agent 아바타 훅
 *
 * Beyond Presence Managed Agent는 자체 LLM+TTS 파이프라인을 보유:
 * 1. POST /v1/calls → livekit_url + livekit_token 반환
 * 2. LiveKit Room에 참가
 * 3. 사용자 마이크 오디오 트랙을 LiveKit에 발행 → BP 에이전트가 수신
 * 4. BP 에이전트가 자체 STT→LLM→TTS 처리 후 립싱크된 비디오+오디오 트랙 발행
 *
 * 기존 useVRMAvatar와 동일한 인터페이스 노출.
 */
export function useVideoAvatar(options: UseVideoAvatarOptions = {}) {
  const { agentId } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const callIdRef = useRef<string | null>(null);
  const hasVideoRef = useRef(false);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // API 키 확인
      if (!BP_API_KEY) {
        console.warn(
          "[VideoAvatar] BEYOND_PRESENCE_API_KEY 미설정 -- 데모 모드"
        );
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // 1. Beyond Presence /v1/calls 로 세션 생성
      const callBody: Record<string, unknown> = {};
      if (agentId) {
        callBody.agent_id = agentId;
      }

      console.log("[VideoAvatar] Beyond Presence 세션 생성 중...", {
        url: `${BP_API_URL}/calls`,
        agentId,
      });

      const callRes = await fetch(`${BP_API_URL}/calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BP_API_KEY,
        },
        body: JSON.stringify(callBody),
      });

      if (!callRes.ok) {
        const errText = await callRes.text();
        throw new Error(
          `Beyond Presence 세션 생성 실패: ${callRes.status} - ${errText}`
        );
      }

      const callData = await callRes.json();
      callIdRef.current = callData.id;

      console.log("[VideoAvatar] Beyond Presence 세션 생성 완료:", {
        callId: callData.id,
        livekitUrl: callData.livekit_url,
      });

      // 2. LiveKit Room에 연결
      const { Room, RoomEvent, Track } = await import("livekit-client");

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // BP 에이전트의 비디오+오디오 트랙 수신
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(
          `[VideoAvatar] 트랙 구독됨: ${track.kind} from ${participant.identity}`
        );
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          hasVideoRef.current = true;
          videoRef.current.dataset.hasStream = "true";
          console.log("[VideoAvatar] 비디오 트랙 연결됨");
        }
        if (track.kind === Track.Kind.Audio && audioRef.current) {
          track.attach(audioRef.current);
          console.log("[VideoAvatar] 오디오 트랙 연결됨 (BP TTS 음성)");
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        if (track.kind === Track.Kind.Video) {
          hasVideoRef.current = false;
          if (videoRef.current) {
            videoRef.current.dataset.hasStream = "false";
          }
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log("[VideoAvatar] LiveKit 연결 끊김");
      });

      // LiveKit 토큰으로 룸 연결
      const livekitUrl = callData.livekit_url;
      const livekitToken = callData.livekit_token;

      if (!livekitUrl || !livekitToken) {
        throw new Error(
          "Beyond Presence 응답에 livekit_url 또는 livekit_token이 없습니다"
        );
      }

      await room.connect(livekitUrl, livekitToken);
      console.log("[VideoAvatar] LiveKit 룸 연결 완료");

      // 사용자 마이크를 LiveKit 오디오 트랙으로 발행
      // → BP Managed Agent가 사용자 음성을 수신하여 대화 처리
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log("[VideoAvatar] 마이크 트랙 활성화 → BP 에이전트에 음성 전달");

      setIsInitialized(true);
      setIsLoading(false);
      console.log(
        `[VideoAvatar] 초기화 완료 -- Beyond Presence 연결됨 (agent: ${agentId || "default"})`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "비디오 아바타 초기화 실패";
      setError(message);
      setIsLoading(false);
      console.error("[VideoAvatar] 초기화 오류:", err);
    }
  }, [agentId]);

  const sendBase64Audio = useCallback((_base64Audio: string) => {
    // BP Managed Agent는 자체 TTS→립싱크 파이프라인 사용
    // 외부 오디오 주입 불필요 — no-op
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // Beyond Presence는 프로소디 기반 감정 표현 -- API 호출 없음
      // TTS 오디오의 톤/억양에서 자동으로 감정 추론하여 표정 생성
    },
    []
  );

  const setConversationPhase = useCallback(
    (_phase: ConversationPhase) => {
      // Beyond Presence는 서버 측 아바타 상태 머신 사용
    },
    []
  );

  const close = useCallback(() => {
    // LiveKit Room 연결 해제
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Beyond Presence 세션 종료
    if (callIdRef.current && BP_API_KEY) {
      fetch(`${BP_API_URL}/calls/${callIdRef.current}`, {
        method: "DELETE",
        headers: { "x-api-key": BP_API_KEY },
      }).catch(() => {});
      callIdRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.dataset.hasStream = "false";
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    hasVideoRef.current = false;

    setIsInitialized(false);
    console.log("[VideoAvatar] 세션 종료");
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
