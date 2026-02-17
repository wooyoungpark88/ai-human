/** 서버에서 프론트엔드로 보내는 WebSocket 메시지 */
export interface ServerMessage {
  type: "transcript" | "response" | "audio" | "emotion" | "error" | "status";
  text?: string;
  emotion?: string;
  intensity?: number;
  audio_data?: string; // base64 인코딩된 PCM 오디오
  is_final?: boolean;
}

/** 프론트엔드에서 서버로 보내는 WebSocket 메시지 */
export interface ClientMessage {
  type: "audio" | "config" | "stop" | "text";
  data?: string; // base64 인코딩된 오디오 데이터
  text?: string; // 텍스트 직접 입력
  profile_id?: string;
  case_id?: string;
}

/** 감정 타입 */
export type EmotionType =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "thinking"
  | "anxious"
  | "empathetic";

/** 감정별 UI 표시 정보 */
export interface EmotionInfo {
  label: string;
  emoji: string;
  color: string;
}

/** 대화 메시지 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  emotion?: EmotionType;
  timestamp: Date;
}

/** 연결 상태 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/** 내담자 케이스 정보 */
export interface CaseInfo {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  presenting_issue: string;
  category: string;
  difficulty: string;
  description: string;
  session_goals: string[];
}
