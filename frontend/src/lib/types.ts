/** 서버에서 프론트엔드로 보내는 WebSocket 메시지 */
export interface ServerMessage {
  type: "transcript" | "response" | "audio" | "emotion" | "error" | "status";
  text?: string;
  emotion?: string;
  intensity?: number;
  audio_data?: string; // base64 인코딩된 PCM 오디오
  is_final?: boolean;
  user_text?: string; // thinking 상태에서 확정된 사용자 발화 텍스트
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

/** 대화 기반 아바타 동작 상태 */
export type ConversationPhase = "idle" | "listening" | "thinking" | "speaking";

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

/** 아바타 타입 */
export type AvatarType = "vrm" | "simli" | "flashhead" | "deepbrain" | "heygen";

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
  avatar_type?: AvatarType;
  simli_face_id?: string;
  flashhead_model_id?: string;
  deepbrain_avatar_id?: string;
  heygen_avatar_id?: string;
  external_url?: string;
  portrait_url?: string;
}

/** 페르소나 빌더 — v2 신규 필드 */
export interface ClinicalInfo {
  primary_diagnosis?: string;
  comorbid?: string[];
  onset_date?: string;
  chronicity?: "acute" | "subacute" | "chronic" | "";
  icd11_code?: string;
}

export interface RiskAssessment {
  suicide: number;       // 0~3
  self_harm: number;
  harm_others: number;
  substance: number;
  warning_signs?: string[];
}

export interface TriggerItem {
  topic: string;
  reaction: string;
  intensity: number;
}

export interface RelationshipNode {
  role: string;
  age?: number;
  quality?: string;
  dynamics?: string;
}

export interface ResistanceCurve {
  initial: number;
  after_rapport: number;
  trust_gates?: string[];
}

export interface SessionPhase {
  phase: string;
  behavior: string;
  duration_turns?: string;
  trigger?: string;
}

export interface RubricItem {
  pattern: string;
  example?: string;
  weight: number;
}

export interface Rubric {
  good_responses: RubricItem[];
  bad_responses: RubricItem[];
}

export interface SafetyProtocols {
  crisis_signals?: string[];
  expected_counselor_response?: string;
  ideal_response_example?: string;
}

/** 빌더가 다루는 전체 페르소나 (저장 직전 상태) */
export interface PersonaDraft {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  presenting_issue: string;
  category: string;
  difficulty: string;
  description: string;
  personality: string;
  speaking_style: string;
  background_story: string;
  symptoms: string[];
  hidden_issues: string[];
  emotional_baseline: string;
  resistance_level: number;
  session_goals: string[];
  system_prompt: string;
  // v2
  clinical?: ClinicalInfo;
  risk_assessment?: RiskAssessment;
  defense_mechanisms?: string[];
  triggers?: TriggerItem[];
  relationships?: RelationshipNode[];
  developmental_history?: string;
  trauma_history?: string[];
  strengths?: string[];
  support_system?: string[];
  coping_resources?: string[];
  resistance_curve?: ResistanceCurve;
  session_phases?: SessionPhase[];
  rubric?: Rubric;
  safety_protocols?: SafetyProtocols;
  cultural_context?: string[];
  schema_version?: number;
  // 정적 초상화 (AI 생성 또는 업로드)
  portrait_url?: string;
  portrait_prompt?: string;
  // 영상 아바타 매핑
  avatar_type?: AvatarType;
  simli_face_id?: string;
  flashhead_model_id?: string;
  deepbrain_avatar_id?: string;
  heygen_avatar_id?: string;
  external_url?: string;
}

/** 피드백 평가 항목 */
export interface FeedbackCategory {
  name: string;
  name_en: string;
  score: number;
  comment: string;
}

/** 상담 세션 피드백 결과 */
export interface SessionFeedback {
  session_id: string;
  case_id: string;
  overall_score: number;
  categories: FeedbackCategory[];
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
}
