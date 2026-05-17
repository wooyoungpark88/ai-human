"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { VRMScene } from "@/components/VRMScene";
import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType, AvatarType } from "@/lib/types";
import { EMOTION_GLOW, EMOTION_BORDER } from "@/lib/constants";
import type { VRMAvatarControllers } from "@/hooks/useVRMAvatar";

interface AvatarViewProps {
  avatarType?: AvatarType;
  // VRM mode props
  vrm?: VRM | null;
  controllers?: VRMAvatarControllers;
  // 비디오 모드 (HeyGen / Simli / FlashHead 공용)
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  // DeepBrain SDK 마운트 컨테이너
  containerRef?: React.RefObject<HTMLDivElement | null>;
  // photo 모드 — currentEmotion에 매칭되는 정적 사진 URL (영상 X)
  photoSrc?: string | null;
  photoName?: string;
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
  containerRef,
  photoSrc,
  photoName,
  isLoading = false,
  isInitialized = false,
  error,
  currentEmotion = "neutral",
  emotionIntensity = 0.5,
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
      className={`relative overflow-hidden bg-black w-full ${
        avatarType === "photo"
          ? "max-w-sm aspect-[3/4] flex-shrink-0"
          : "max-w-lg aspect-square"
      } mx-auto rounded-2xl border-2 transition-all duration-700 ${borderClass} ${glowClass}`}
      style={
        avatarType === "photo"
          ? { aspectRatio: "3 / 4", flexShrink: 0 }
          : { aspectRatio: "1 / 1" }
      }
    >
      {/* VRM 아바타 */}
      {avatarType === "vrm" && isInitialized && vrm && controllers && (
        <VRMScene vrm={vrm} controllers={controllers} isLoading={isLoading} />
      )}

      {/* photo 모드 — 영상 없이 currentEmotion 사진 표시 */}
      {avatarType === "photo" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photoSrc}
              src={photoSrc}
              alt={photoName || "내담자"}
              className="w-full h-full object-cover transition-opacity duration-700"
              style={{
                opacity: 0.85 + emotionIntensity * 0.15,
                objectPosition: "center top",  // 얼굴(상단) 보존, 비율 다를 때 하단만 trim
              }}
            />
          ) : (
            <div className="text-center px-4" style={{ color: "rgba(255,255,255,0.6)" }}>
              <div className="text-[56px] leading-none mb-2">🖼️</div>
              <p className="text-sm">초상화 미설정</p>
              <p className="text-xs opacity-60 mt-1">
                portraits/{`{case_id}_{emotion}.jpg`} 형식으로 추가하세요
              </p>
            </div>
          )}
          {/* 감정 라벨 오버레이 */}
          {photoSrc && isInitialized && (
            <div
              className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full text-[11.5px] font-bold backdrop-blur-md"
              style={{
                background: "rgba(255, 246, 234, 0.85)",
                color: "var(--tc-accent-deep)",
              }}
            >
              {currentEmotion} · {Math.round(emotionIntensity * 100)}%
            </div>
          )}
        </div>
      )}

      {/* HeyGen Interactive Avatar — video/audio는 initialize() 전에 DOM에 마운트 필요 */}
      {avatarType === "heygen" && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <audio ref={audioRef} autoPlay />
          {isInitialized && !hasVideoStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800/95 to-slate-900/95 pointer-events-none">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
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
                <p className="text-violet-300 text-sm font-medium">AI Avatar</p>
                <p className="text-slate-500 text-xs mt-1">HeyGen Interactive</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FlashHead 아바타 (로컬 GPU 사이드카, 케이스별 학습 모델) */}
      {avatarType === "flashhead" && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          <audio ref={audioRef} autoPlay />
          {isInitialized && !hasVideoStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800/95 to-slate-900/95">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
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
                <p className="text-emerald-300 text-sm font-medium">AI Avatar</p>
                <p className="text-slate-500 text-xs mt-1">FlashHead (local)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DeepBrain AI Human — SDK가 container div에 캔버스 마운트 */}
      {avatarType === "deepbrain" && (
        <div className="absolute inset-0">
          <div ref={containerRef} className="w-full h-full" />
          {!isInitialized && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800/95 to-slate-900/95 pointer-events-none">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
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
                <p className="text-sky-300 text-sm font-medium">AI Avatar</p>
                <p className="text-slate-500 text-xs mt-1">
                  DeepBrain AI Human
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simli 아바타 — video/audio는 initialize() 전에 DOM에 마운트 필요 */}
      {avatarType === "simli" && (
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
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
              {avatarType === "heygen"
                ? "HeyGen 연결 중..."
                : avatarType === "simli"
                  ? "Simli 연결 중..."
                  : avatarType === "flashhead"
                    ? "FlashHead 사이드카 연결 중..."
                    : avatarType === "deepbrain"
                      ? "DeepBrain AI Human 연결 중..."
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
