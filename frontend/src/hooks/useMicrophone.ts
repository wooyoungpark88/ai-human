"use client";

import { useCallback, useRef, useState } from "react";
import { AUDIO_CONFIG } from "@/lib/constants";

interface UseMicrophoneOptions {
  onAudioData?: (base64Data: string) => void;
}

export function useMicrophone(options: UseMicrophoneOptions = {}) {
  const { onAudioData } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // 마이크 접근 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.sampleRate,
          channelCount: AUDIO_CONFIG.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // AudioContext 생성
      const audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // ScriptProcessorNode 사용 (AudioWorklet 대비 호환성 우수)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Float32 -> Int16 PCM 변환
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Base64 인코딩
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        onAudioDataRef.current?.(base64);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      console.log("[Mic] 녹음 시작");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "마이크 접근 실패";
      setError(message);
      console.error("[Mic] 오류:", message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    // 프로세서 연결 해제
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // AudioContext 종료
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 미디어 스트림 종료
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    console.log("[Mic] 녹음 종료");
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
  };
}
