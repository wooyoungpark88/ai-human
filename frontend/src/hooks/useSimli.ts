"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimliClient } from "simli-client";
import { SIMLI_API_KEY, SIMLI_FACE_ID } from "@/lib/constants";

interface UseSimliOptions {
  faceId?: string;
  apiKey?: string;
}

export function useSimli(options: UseSimliOptions = {}) {
  const { faceId = SIMLI_FACE_ID, apiKey = SIMLI_API_KEY } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simliClientRef = useRef<SimliClient | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** Simli 클라이언트를 초기화합니다. */
  const initialize = useCallback(
    async (
      videoElement: HTMLVideoElement,
      audioElement: HTMLAudioElement
    ) => {
      if (!faceId || !apiKey) {
        setError("Simli API Key 또는 Face ID가 설정되지 않았습니다.");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        videoRef.current = videoElement;
        audioRef.current = audioElement;

        const client = new SimliClient();

        client.Initialize({
          apiKey,
          faceID: faceId,
          handleSilence: true,
          maxSessionLength: 3600,
          maxIdleTime: 600,
          videoRef: videoElement,
          audioRef: audioElement,
          session_token: "",
          SimliURL: "",
          maxRetryAttempts: 100,
          retryDelay_ms: 2000,
          videoReceivedTimeout: 15000,
          enableSFU: true,
          model: "",
        });

        simliClientRef.current = client;

        await client.start();

        setIsInitialized(true);
        setIsLoading(false);
        console.log("[Simli] 초기화 완료");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Simli 초기화 실패";
        setError(message);
        setIsLoading(false);
        console.error("[Simli] 초기화 오류:", message);
      }
    },
    [faceId, apiKey]
  );

  /** PCM 오디오 데이터를 Simli에 전송합니다. (립싱크 + 표정용) */
  const sendAudioData = useCallback((pcmData: Uint8Array) => {
    if (simliClientRef.current && isInitialized) {
      simliClientRef.current.sendAudioData(pcmData);
    }
  }, [isInitialized]);

  /** Base64 인코딩된 오디오를 디코딩하여 Simli에 전송합니다. */
  const sendBase64Audio = useCallback(
    (base64Audio: string) => {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        sendAudioData(bytes);
      } catch (err) {
        console.error("[Simli] 오디오 데이터 전송 오류:", err);
      }
    },
    [sendAudioData]
  );

  /** Simli 세션을 종료합니다. */
  const close = useCallback(() => {
    if (simliClientRef.current) {
      simliClientRef.current.close();
      simliClientRef.current = null;
    }
    setIsInitialized(false);
    console.log("[Simli] 세션 종료");
  }, []);

  // 컴포넌트 언마운트 시 정리
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
    sendAudioData,
    sendBase64Audio,
    close,
    videoRef,
    audioRef,
  };
}
