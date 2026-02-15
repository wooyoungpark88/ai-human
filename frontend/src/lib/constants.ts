import type { EmotionType, EmotionInfo } from "./types";

/** 백엔드 API URL */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** 백엔드 WebSocket URL */
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/conversation";

/** Simli API Key (클라이언트에서 사용) */
export const SIMLI_API_KEY = process.env.NEXT_PUBLIC_SIMLI_API_KEY || "";

/** Simli Face ID */
export const SIMLI_FACE_ID = process.env.NEXT_PUBLIC_SIMLI_FACE_ID || "";

/** 오디오 설정 */
export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channelCount: 1,
  bitsPerSample: 16,
} as const;

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
