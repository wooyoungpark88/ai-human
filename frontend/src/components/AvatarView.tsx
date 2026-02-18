"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { VRMScene } from "@/components/VRMScene";
import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType, AvatarType } from "@/lib/types";
import type { VRMAvatarControllers } from "@/hooks/useVRMAvatar";

const EMOTION_GLOW: Record<string, string> = {
  neutral: "shadow-none",
  happy: "shadow-[0_0_25px_rgba(250,204,21,0.4)]",
  sad: "shadow-[0_0_25px_rgba(96,165,250,0.4)]",
  angry: "shadow-[0_0_25px_rgba(248,113,113,0.4)]",
  surprised: "shadow-[0_0_25px_rgba(192,132,252,0.4)]",
  thinking: "shadow-[0_0_25px_rgba(129,140,248,0.4)]",
  anxious: "shadow-[0_0_25px_rgba(251,146,60,0.4)]",
  empathetic: "shadow-[0_0_25px_rgba(74,222,128,0.4)]",
};

const EMOTION_BORDER: Record<string, string> = {
  neutral: "border-transparent",
  happy: "border-yellow-400/60",
  sad: "border-blue-400/60",
  angry: "border-red-400/60",
  surprised: "border-purple-400/60",
  thinking: "border-indigo-400/60",
  anxious: "border-orange-400/60",
  empathetic: "border-green-400/60",
};

interface AvatarViewProps {
  avatarType?: AvatarType;
  // VRM mode props
  vrm?: VRM | null;
  controllers?: VRMAvatarControllers;
  // Video mode props (Beyond Presence / Simli 공용)
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  // Beyond Presence / Simli 공용 — 오디오 엘리먼트
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  // Common props
  isLoading?: boolean;
  isInitialized?: boolean;
  error?: string | null;
  currentEmotion?: EmotionType;
  emotionIntensity?: number;
}

export function AvatarView({
  avatarType = "vrm",
  vrm,
  controllers,
  videoRef,
  audioRef,
  isLoading = false,
  isInitialized = false,
  error,
  currentEmotion = "neutral",
}: AvatarViewProps) {
  const glowClass = EMOTION_GLOW[currentEmotion] ?? EMOTION_GLOW.neutral;
  const borderClass = EMOTION_BORDER[currentEmotion] ?? EMOTION_BORDER.neutral;

  // 비디오 스트림이 활성화되면 데모 오버레이 숨김
  const [hasVideoStream, setHasVideoStream] = useState(false);
  useEffect(() => {
    const el = videoRef?.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      setHasVideoStream(el.dataset.hasStream === "true");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-has-stream"] });
    // 초기 상태도 체크
    setHasVideoStream(el.dataset.hasStream === "true");
    return () => observer.disconnect();
  }, [videoRef, isInitialized]);

  return (
    <Card
      className={`relative overflow-hidden bg-black aspect-video w-full max-w-2xl mx-auto rounded-2xl border-2 transition-all duration-700 ${borderClass} ${glowClass}`}
    >
      {/* VRM 아바타 */}
      {avatarType === "vrm" && isInitialized && vrm && controllers && (
        <VRMScene vrm={vrm} controllers={controllers} isLoading={isLoading} />
      )}

      {/* 비디오 아바타 (Beyond Presence) — video/audio는 initialize() 전에 DOM에 마운트 필요 */}
      {avatarType === "video" && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <audio ref={audioRef} autoPlay />
          {/* 데모 모드 오버레이 (비디오 스트림 없을 때) */}
          {isInitialized && !hasVideoStream && <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800/95 to-slate-900/95 video-demo-placeholder">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg
                  className="w-14 h-14 text-white"
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
              <p className="text-blue-300 text-sm font-medium">
                AI Human Avatar
              </p>
              <p className="text-slate-500 text-xs mt-1">Beyond Presence</p>
            </div>
          </div>}
        </div>
      )}

      {/* Simli 아바타 — video/audio는 initialize() 전에 DOM에 마운트 필요 */}
      {avatarType === "simli" && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <audio ref={audioRef} autoPlay />
          {/* 데모 모드 오버레이 (비디오 스트림 없을 때) */}
          {isInitialized && !hasVideoStream && <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800/95 to-slate-900/95">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <svg
                  className="w-14 h-14 text-white"
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
              <p className="text-purple-300 text-sm font-medium">
                AI Avatar
              </p>
              <p className="text-slate-500 text-xs mt-1">Simli</p>
            </div>
          </div>}
        </div>
      )}

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white text-sm">
              {avatarType === "video"
                ? "Beyond Presence 연결 중..."
                : avatarType === "simli"
                  ? "Simli 연결 중..."
                  : "아바타 로딩 중..."}
            </p>
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
              내담자를 선택하고 상담을 시작하세요
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
