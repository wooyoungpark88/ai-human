import type { EmotionType, EmotionInfo } from "./types";

/** 백엔드 API URL */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** 백엔드 WebSocket URL */
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/conversation";

/** VRM 아바타 모델 경로 */
export const VRM_MODEL_PATH = "/models/avatar.vrm";

/** 오디오 설정 */
export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channelCount: 1,
  bitsPerSample: 16,
} as const;

/** 케이스 카테고리 레이블 */
export const CATEGORY_LABELS: Record<string, string> = {
  burnout: "번아웃",
  anxiety: "불안",
  relationship: "관계",
  depression: "우울",
  self_esteem: "자존감",
};

/** 케이스 카테고리 색상 */
export const CATEGORY_COLORS: Record<string, string> = {
  burnout: "bg-orange-100 text-orange-800",
  anxiety: "bg-purple-100 text-purple-800",
  relationship: "bg-pink-100 text-pink-800",
  depression: "bg-blue-100 text-blue-800",
  self_esteem: "bg-green-100 text-green-800",
};

/** 난이도 레이블 */
export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

/** 난이도 색상 */
export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-800",
  intermediate: "bg-amber-100 text-amber-800",
  advanced: "bg-red-100 text-red-800",
};

/** 감정별 아바타 카드 글로우 (Tailwind shadow) */
export const EMOTION_GLOW: Record<EmotionType, string> = {
  neutral: "shadow-none",
  happy: "shadow-[0_0_25px_rgba(250,204,21,0.4)]",
  sad: "shadow-[0_0_25px_rgba(96,165,250,0.4)]",
  angry: "shadow-[0_0_25px_rgba(248,113,113,0.4)]",
  surprised: "shadow-[0_0_25px_rgba(192,132,252,0.4)]",
  thinking: "shadow-[0_0_25px_rgba(129,140,248,0.4)]",
  anxious: "shadow-[0_0_25px_rgba(251,146,60,0.4)]",
  empathetic: "shadow-[0_0_25px_rgba(74,222,128,0.4)]",
};

/** 감정별 아바타 카드 보더 (Tailwind border-color) */
export const EMOTION_BORDER: Record<EmotionType, string> = {
  neutral: "border-transparent",
  happy: "border-yellow-400/60",
  sad: "border-blue-400/60",
  angry: "border-red-400/60",
  surprised: "border-purple-400/60",
  thinking: "border-indigo-400/60",
  anxious: "border-orange-400/60",
  empathetic: "border-green-400/60",
};

/** 감정별 UI 매핑 */
export const EMOTION_MAP: Record<EmotionType, EmotionInfo> = {
  neutral: { label: "평온", emoji: "😐", color: "bg-gray-100 text-gray-800" },
  happy: { label: "행복", emoji: "😊", color: "bg-yellow-100 text-yellow-800" },
  sad: { label: "슬픔", emoji: "😢", color: "bg-blue-100 text-blue-800" },
  angry: { label: "화남", emoji: "😠", color: "bg-red-100 text-red-800" },
  surprised: {
    label: "놀람",
    emoji: "😲",
    color: "bg-purple-100 text-purple-800",
  },
  thinking: {
    label: "생각중",
    emoji: "🤔",
    color: "bg-indigo-100 text-indigo-800",
  },
  anxious: {
    label: "불안",
    emoji: "😰",
    color: "bg-orange-100 text-orange-800",
  },
  empathetic: {
    label: "공감",
    emoji: "🤗",
    color: "bg-green-100 text-green-800",
  },
};
