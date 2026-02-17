"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmotionType } from "@/lib/types";
import { AudioStreamPlayer } from "@/lib/audio/AudioStreamPlayer";

const BP_API_URL =
  process.env.NEXT_PUBLIC_BEYOND_PRESENCE_API_URL ||
  "https://api.beyondpresence.ai/v1";
const BP_API_KEY = process.env.NEXT_PUBLIC_BEYOND_PRESENCE_API_KEY || "";

interface UseVideoAvatarOptions {
  /** Beyond Presence 아바타 ID (대시보드에서 생성한 아바타) */
  avatarId?: string;
}

/**
 * Beyond Presence Speech-to-Video 아바타 훅
 *
 * 기존 useVRMAvatar와 동일한 인터페이스를 노출하여
 * 세션 페이지에서 드롭인 교체 가능.
 *
 * 흐름:
 * 1. initialize() → Beyond Presence 세션 생성 (avatarId 포함) → WebRTC 연결
 * 2. sendBase64Audio() → PCM 오디오를 BP에 전송 → 아바타 비디오 수신
 * 3. setEmotion() → CSS 오버레이 효과 (BP는 프로소디 기반 감정)
 * 4. close() → 세션 종료 + 리소스 정리
 */
export function useVideoAvatar(options: UseVideoAvatarOptions = {}) {
  const { avatarId } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // API 키 확인
      if (!BP_API_KEY) {
        console.warn(
          "[VideoAvatar] BEYOND_PRESENCE_API_KEY 미설정 — 데모 모드"
        );
        const audioPlayer = new AudioStreamPlayer();
        await audioPlayer.init();
        audioPlayerRef.current = audioPlayer;
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // 1. Beyond Presence 세션 생성 (avatarId 포함)
      const sessionBody: Record<string, unknown> = {
        type: "speech-to-video",
        config: {
          resolution: "720p",
          audio_format: "pcm_16000",
        },
      };
      if (avatarId) {
        sessionBody.avatar_id = avatarId;
      }

      const sessionRes = await fetch(`${BP_API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BP_API_KEY}`,
        },
        body: JSON.stringify(sessionBody),
      });

      if (!sessionRes.ok) {
        throw new Error(
          `Beyond Presence 세션 생성 실패: ${sessionRes.status}`
        );
      }

      const sessionData = await sessionRes.json();
      sessionIdRef.current = sessionData.session_id;

      // 2. WebRTC 연결 수립
      const pc = new RTCPeerConnection({
        iceServers: sessionData.ice_servers || [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });
      peerConnectionRef.current = pc;

      // 비디오 수신 트랙 핸들링
      pc.ontrack = (event) => {
        if (event.track.kind === "video" && videoRef.current) {
          videoRef.current.srcObject = new MediaStream([event.track]);
          videoRef.current.play().catch(() => {});
        }
      };

      // 오디오 전송용 DataChannel
      const dc = pc.createDataChannel("audio", { ordered: true });
      dataChannelRef.current = dc;

      // SDP offer 생성 + 서버에 전달
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answerRes = await fetch(
        `${BP_API_URL}/sessions/${sessionData.session_id}/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BP_API_KEY}`,
          },
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
          }),
        }
      );

      if (!answerRes.ok) {
        throw new Error(`WebRTC 연결 실패: ${answerRes.status}`);
      }

      const answerData = await answerRes.json();
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          sdp: answerData.sdp,
          type: answerData.type,
        })
      );

      // 오디오 재생기 (로컬 오디오 재생 — 아바타 비디오와 동기화)
      const audioPlayer = new AudioStreamPlayer();
      await audioPlayer.init();
      audioPlayerRef.current = audioPlayer;

      setIsInitialized(true);
      setIsLoading(false);
      console.log(
        `[VideoAvatar] 초기화 완료 — Beyond Presence 연결됨 (avatar: ${avatarId || "default"})`
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

    // Beyond Presence에 오디오 전달 (DataChannel)
    const dc = dataChannelRef.current;
    if (dc && dc.readyState === "open") {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      dc.send(bytes.buffer);
    }
  }, []);

  const setEmotion = useCallback(
    (_emotion: EmotionType, _intensity: number) => {
      // Beyond Presence는 프로소디 기반 감정 표현 — API 호출 없음
      // TTS 오디오의 톤/억양에서 자동으로 감정 추론하여 표정 생성
      // CSS 오버레이 효과는 AvatarView에서 currentEmotion으로 처리
    },
    []
  );

  const close = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (sessionIdRef.current && BP_API_KEY) {
      fetch(`${BP_API_URL}/sessions/${sessionIdRef.current}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${BP_API_KEY}` },
      }).catch(() => {});
      sessionIdRef.current = null;
    }

    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    audioPlayerRef.current?.dispose();
    audioPlayerRef.current = null;

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
