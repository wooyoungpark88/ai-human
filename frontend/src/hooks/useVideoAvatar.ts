"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmotionType } from "@/lib/types";
import { AudioStreamPlayer } from "@/lib/audio/AudioStreamPlayer";

const BP_API_URL =
  process.env.NEXT_PUBLIC_BEYOND_PRESENCE_API_URL ||
  "https://api.bey.dev/v1";
const BP_API_KEY = process.env.NEXT_PUBLIC_BEYOND_PRESENCE_API_KEY || "";

interface UseVideoAvatarOptions {
  avatarId?: string;
}

/**
 * Beyond Presence Speech-to-Video 아바타 훅
 *
 * Beyond Presence는 LiveKit 기반 서버 사이드 아키텍처 사용:
 * 1. POST /v1/calls → livekit_url + livekit_token 반환
 * 2. LiveKit Room에 참가하여 아바타 비디오 트랙 수신
 * 3. 오디오를 LiveKit DataStream으로 전송
 *
 * 기존 useVRMAvatar와 동일한 인터페이스 노출.
 */
export function useVideoAvatar(options: UseVideoAvatarOptions = {}) {
  const { avatarId } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const callIdRef = useRef<string | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
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
        const audioPlayer = new AudioStreamPlayer();
        await audioPlayer.init();
        audioPlayerRef.current = audioPlayer;
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // 1. Beyond Presence /v1/calls 로 세션 생성
      const callBody: Record<string, unknown> = {};
      if (avatarId) {
        callBody.avatar_id = avatarId;
      }

      console.log("[VideoAvatar] Beyond Presence 세션 생성 중...", {
        url: `${BP_API_URL}/calls`,
        avatarId,
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

      // 비디오 트랙 수신 이벤트
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(
          `[VideoAvatar] 트랙 구독됨: ${track.kind} from ${participant.identity}`
        );
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          hasVideoRef.current = true;
          // 데모 오버레이를 숨기기 위해 video 엘리먼트에 클래스 추가
          videoRef.current.dataset.hasStream = "true";
          console.log("[VideoAvatar] 비디오 트랙 연결됨");
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          track.detach();
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

      // 오디오 재생기 (로컬 오디오 재생)
      const audioPlayer = new AudioStreamPlayer();
      await audioPlayer.init();
      audioPlayerRef.current = audioPlayer;

      setIsInitialized(true);
      setIsLoading(false);
      console.log(
        `[VideoAvatar] 초기화 완료 -- Beyond Presence 연결됨 (avatar: ${avatarId || "default"})`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "비디오 아바타 초기화 실패";
      setError(message);
      setIsLoading(false);
      console.error("[VideoAvatar] 초기화 오류:", err);
    }
  }, [avatarId]);

  const sendBase64Audio = useCallback((base64Audio: string) => {
    // 로컬 오디오 재생 (항상)
    audioPlayerRef.current?.feedBase64Chunk(base64Audio);

    // Beyond Presence에 오디오 전달 (LiveKit DataStream)
    const room = roomRef.current;
    if (room && room.state === "connected") {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // LiveKit의 localParticipant를 통해 오디오 데이터 전송
        // Beyond Presence는 룸의 오디오 트랙을 자동으로 구독하여 립싱크 처리
        room.localParticipant
          .publishData(bytes, { reliable: true })
          .catch((err: unknown) => {
            console.warn("[VideoAvatar] 오디오 데이터 전송 실패:", err);
          });
      } catch (err) {
        console.warn("[VideoAvatar] 오디오 인코딩 오류:", err);
      }
    }
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // Beyond Presence는 프로소디 기반 감정 표현 -- API 호출 없음
      // TTS 오디오의 톤/억양에서 자동으로 감정 추론하여 표정 생성
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

    audioPlayerRef.current?.dispose();
    audioPlayerRef.current = null;
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
    close,
    videoRef,
  };
}
