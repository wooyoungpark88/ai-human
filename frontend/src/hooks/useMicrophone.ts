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

  /** Int16 PCM → Base64 변환 */
  const pcmToBase64 = useCallback((buffer: ArrayBuffer) => {
    const uint8Array = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }, []);

  /** AudioWorklet으로 녹음 시작 (레이턴시 최적화: 128ms 버퍼) */
  const startWithWorklet = useCallback(
    async (audioContext: AudioContext, source: MediaStreamAudioSourceNode) => {
      await audioContext.audioWorklet.addModule("/audio-processor.js");
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const { pcmData } = event.data;
        if (pcmData) {
          onAudioDataRef.current?.(pcmToBase64(pcmData));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
    },
    [pcmToBase64]
  );

  /** ScriptProcessorNode fallback (AudioWorklet 미지원 시) */
  const startWithScriptProcessor = useCallback(
    (audioContext: AudioContext, source: MediaStreamAudioSourceNode) => {
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        onAudioDataRef.current?.(pcmToBase64(pcmData.buffer));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    },
    [pcmToBase64]
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);

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

      const audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // AudioWorklet 우선, ScriptProcessorNode fallback
      try {
        await startWithWorklet(audioContext, source);
        console.log("[Mic] AudioWorklet 모드로 녹음 시작 (128ms 버퍼)");
      } catch {
        startWithScriptProcessor(audioContext, source);
        console.log("[Mic] ScriptProcessor fallback 모드로 녹음 시작 (256ms 버퍼)");
      }

      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "마이크 접근 실패";
      setError(message);
      console.error("[Mic] 오류:", message);
    }
  }, [startWithWorklet, startWithScriptProcessor]);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

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
