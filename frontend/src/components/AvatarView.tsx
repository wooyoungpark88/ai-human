"use client";

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

interface AvatarViewProps {
  onVideoRef?: (video: HTMLVideoElement) => void;
  onAudioRef?: (audio: HTMLAudioElement) => void;
  isLoading?: boolean;
  isInitialized?: boolean;
  error?: string | null;
}

export function AvatarView({
  onVideoRef,
  onAudioRef,
  isLoading = false,
  isInitialized = false,
  error,
}: AvatarViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && onVideoRef) {
      onVideoRef(videoRef.current);
    }
    if (audioRef.current && onAudioRef) {
      onAudioRef(audioRef.current);
    }
  }, [onVideoRef, onAudioRef]);

  return (
    <Card className="relative overflow-hidden bg-black aspect-video w-full max-w-2xl mx-auto rounded-2xl">
      {/* Simli 아바타 비디오 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* 숨겨진 오디오 요소 (Simli 출력용) */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white text-sm">아바타 로딩 중...</p>
          </div>
        </div>
      )}

      {/* 초기화 전 플레이스홀더 */}
      {!isInitialized && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">
              시작 버튼을 눌러 대화를 시작하세요
            </p>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
