"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AvatarView } from "@/components/AvatarView";
import { ChatPanel } from "@/components/ChatPanel";
import { MicButton } from "@/components/MicButton";
import { SessionDashboard } from "@/components/SessionDashboard";
import { EMOTION_MAP } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useVRMAvatar } from "@/hooks/useVRMAvatar";
import { useSimliAvatar } from "@/hooks/useSimliAvatar";
import { useDeepBrainAvatar } from "@/hooks/useDeepBrainAvatar";
import { useHeyGenAvatar } from "@/hooks/useHeyGenAvatar";
import { API_URL } from "@/lib/constants";
import type {
  ChatMessage,
  ConversationPhase,
  EmotionType,
  ServerMessage,
  ConnectionStatus,
  CaseInfo,
  AvatarType,
} from "@/lib/types";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  // 상태 관리
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("neutral");
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [textInput, setTextInput] = useState("");
  const [sttAvailable, setSttAvailable] = useState(true);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);

  // Refs
  const messageIdRef = useRef(0);
  const partialTranscriptRef = useRef("");
  const conversationPhaseRef = useRef<ConversationPhase>("idle");

  // 아바타 타입 결정 (케이스 정보에서)
  const avatarType: AvatarType = caseInfo?.avatar_type || "vrm";

  // 모든 아바타 훅 호출 (React 훅 규칙: 조건부 호출 불가)
  const vrmAvatar = useVRMAvatar();
  const simliAvatar = useSimliAvatar({
    faceId: caseInfo?.simli_face_id || undefined,
  });
  const deepbrainAvatar = useDeepBrainAvatar({
    // 케이스 프로필의 deepbrain_avatar_id가 곧 AIPlayer.init({ aiName }) 값.
    // 비워두면 generateToken 응답의 defaultAI.ai_name 사용.
    aiName: caseInfo?.deepbrain_avatar_id || undefined,
  });
  const heygenAvatar = useHeyGenAvatar({
    avatarName: caseInfo?.heygen_avatar_id || undefined,
    language: "ko",
  });

  // 활성 아바타 선택
  const avatar = useMemo(() => {
    if (avatarType === "heygen") {
      return {
        isInitialized: heygenAvatar.isInitialized,
        isLoading: heygenAvatar.isLoading,
        error: heygenAvatar.error,
        initialize: heygenAvatar.initialize,
        sendBase64Audio: heygenAvatar.sendBase64Audio,
        setEmotion: heygenAvatar.setEmotion,
        setConversationPhase: heygenAvatar.setConversationPhase,
        close: heygenAvatar.close,
      };
    }
    if (avatarType === "simli") {
      return {
        isInitialized: simliAvatar.isInitialized,
        isLoading: simliAvatar.isLoading,
        error: simliAvatar.error,
        initialize: simliAvatar.initialize,
        sendBase64Audio: simliAvatar.sendBase64Audio,
        setEmotion: simliAvatar.setEmotion,
        setConversationPhase: simliAvatar.setConversationPhase,
        close: simliAvatar.close,
      };
    }
    if (avatarType === "deepbrain") {
      return {
        isInitialized: deepbrainAvatar.isInitialized,
        isLoading: deepbrainAvatar.isLoading,
        error: deepbrainAvatar.error,
        initialize: deepbrainAvatar.initialize,
        sendBase64Audio: deepbrainAvatar.sendBase64Audio,
        setEmotion: deepbrainAvatar.setEmotion,
        setConversationPhase: deepbrainAvatar.setConversationPhase,
        close: deepbrainAvatar.close,
      };
    }
    return {
      isInitialized: vrmAvatar.isInitialized,
      isLoading: vrmAvatar.isLoading,
      error: vrmAvatar.error,
      initialize: vrmAvatar.initialize,
      sendBase64Audio: vrmAvatar.sendBase64Audio,
      setEmotion: vrmAvatar.setEmotion,
      setConversationPhase: vrmAvatar.setConversationPhase,
      close: vrmAvatar.close,
    };
  }, [avatarType, vrmAvatar, simliAvatar, deepbrainAvatar, heygenAvatar]);

  // 케이스 정보 로드
  useEffect(() => {
    async function loadCaseInfo() {
      try {
        const res = await fetch(`${API_URL}/api/cases/${caseId}`);
        const json = await res.json();
        if (json.id) setCaseInfo(json);
      } catch (err) {
        console.warn("케이스 정보 로드 실패:", err);
      }
    }
    if (caseId) loadCaseInfo();
  }, [caseId]);

  // partialTranscript ref 동기화
  useEffect(() => {
    partialTranscriptRef.current = partialTranscript;
  }, [partialTranscript]);

  // WebSocket 메시지 핸들러
  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "transcript":
          if (message.text) {
            setPartialTranscript(message.text);
            partialTranscriptRef.current = message.text;
          }
          break;

        case "response":
          if (message.text) {
            const msgId = `msg-${++messageIdRef.current}`;
            setMessages((prev) => [
              ...prev,
              {
                id: msgId,
                role: "assistant",
                text: message.text!,
                emotion: message.emotion as EmotionType,
                timestamp: new Date(),
              },
            ]);
            // DeepBrain/HeyGen은 자체 TTS — 텍스트를 SDK에 직접 전달
            if (avatarType === "deepbrain") {
              deepbrainAvatar.speakText(message.text);
            } else if (avatarType === "heygen") {
              heygenAvatar.speakText(message.text);
            }
          }
          setIsThinking(false);
          break;

        case "audio":
          if (message.audio_data && !message.is_final) {
            setIsSpeaking(true);
            avatar.sendBase64Audio(message.audio_data);
          }
          if (message.is_final) {
            setIsSpeaking(false);
          }
          break;

        case "emotion":
          if (message.emotion) {
            setCurrentEmotion(message.emotion as EmotionType);
            avatar.setEmotion(
              message.emotion as EmotionType,
              message.intensity ?? 0.5
            );
          }
          if (message.intensity !== undefined) {
            setEmotionIntensity(message.intensity);
          }
          break;

        case "status":
          if (message.text === "thinking") {
            setIsThinking(true);
            // user_text: 백엔드가 확정한 사용자 발화 (우선), fallback: partialTranscript
            const userText = message.user_text || partialTranscriptRef.current;
            if (userText) {
              const msgId = `msg-${++messageIdRef.current}`;
              setMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  role: "user",
                  text: userText,
                  timestamp: new Date(),
                },
              ]);
            }
            setPartialTranscript("");
            partialTranscriptRef.current = "";
          } else if (message.text === "stt_unavailable") {
            setSttAvailable(false);
          }
          break;

        case "error":
          console.error("[Server Error]", message.text);
          setIsThinking(false);
          setIsSpeaking(false);
          break;
      }
    },
    [avatar, avatarType, deepbrainAvatar, heygenAvatar]
  );

  // WebSocket 훅
  const ws = useWebSocket({ onMessage: handleServerMessage });

  // 마이크 훅
  const mic = useMicrophone({
    onAudioData: (base64Data) => {
      ws.sendAudio(base64Data);
    },
  });

  // 대화 상태 머신: speaking > thinking > listening > idle
  useEffect(() => {
    let nextPhase: ConversationPhase = "idle";

    if (!isSessionActive) {
      nextPhase = "idle";
    } else if (isSpeaking) {
      nextPhase = "speaking";
    } else if (isThinking) {
      nextPhase = "thinking";
    } else if (mic.isRecording) {
      nextPhase = "listening";
    }

    if (nextPhase !== conversationPhaseRef.current) {
      conversationPhaseRef.current = nextPhase;
      avatar.setConversationPhase(nextPhase);
    }
  }, [
    avatar,
    isSessionActive,
    isSpeaking,
    isThinking,
    mic.isRecording,
  ]);

  // 세션 시작
  const handleStartSession = useCallback(async () => {
    // DeepBrain/HeyGen은 자체 TTS지만 backend에 별도 모드가 없어 full로 연결 후
    // sendBase64Audio를 no-op으로 두고 speakText(text)만 사용함
    ws.connect(caseId);
    await avatar.initialize();
    setIsThinking(false);
    setIsSpeaking(false);
    conversationPhaseRef.current = "idle";
    avatar.setConversationPhase("idle");
    setIsSessionActive(true);
    setSessionStartedAt(new Date());
  }, [ws, avatar, caseId, avatarType]);

  // 세션 종료 + 피드백 생성
  const handleStopSession = useCallback(async () => {
    mic.stopRecording();
    ws.sendMessage({ type: "stop" });
    ws.disconnect();
    avatar.close();
    setIsSessionActive(false);
    setIsThinking(false);
    setIsSpeaking(false);
    setPartialTranscript("");
    conversationPhaseRef.current = "idle";
    avatar.setConversationPhase("idle");

    // 대화가 있으면 피드백 생성
    if (messages.length >= 2) {
      setIsGeneratingFeedback(true);
      try {
        const res = await fetch(`${API_URL}/api/feedback/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            case_id: caseId,
            messages: messages.map((m) => ({ role: m.role, text: m.text })),
          }),
        });
        const feedback = await res.json();
        sessionStorage.setItem("lastFeedback", JSON.stringify(feedback));
        sessionStorage.setItem("lastCaseId", caseId);
        router.push("/feedback");
      } catch (err) {
        console.error("피드백 생성 실패:", err);
        setIsGeneratingFeedback(false);
      }
    }
  }, [mic, ws, avatar, messages, caseId, router]);

  // 텍스트 메시지 전송
  const handleSendText = useCallback(() => {
    const text = textInput.trim();
    if (!text || !ws.isConnected) return;

    const msgId = `msg-${++messageIdRef.current}`;
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: "user", text, timestamp: new Date() },
    ]);

    ws.sendMessage({ type: "text", text });
    setTextInput("");
  }, [textInput, ws]);

  // 마이크 토글
  const handleMicToggle = useCallback(() => {
    if (mic.isRecording) {
      mic.stopRecording();
    } else {
      mic.startRecording();
    }
  }, [mic]);

  // 연결 상태 색상
  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "연결됨";
      case "connecting":
        return "연결 중...";
      case "error":
        return "연결 오류";
      default:
        return "연결 안됨";
    }
  };

  // 피드백 생성 중 로딩 화면
  if (isGeneratingFeedback) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <h2 className="text-lg font-semibold">피드백 생성 중...</h2>
          <p className="text-sm text-muted-foreground">
            AI 수퍼바이저가 상담을 분석하고 있습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      {/* 헤더 */}
      <header
        className="px-4 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b flex-wrap"
        style={{
          background: "var(--tc-card-white)",
          borderColor: "var(--tc-border)",
        }}
      >
        <Link
          href="/cases"
          className="text-[12px] hover:underline flex-shrink-0"
          style={{ color: "var(--tc-text-sec)" }}
          aria-label="케이스 목록으로 돌아가기"
        >
          <span className="sm:hidden">&larr;</span>
          <span className="hidden sm:inline">&larr; 케이스 목록</span>
        </Link>
        <h1
          className="text-[16px] sm:text-[18px] font-bold truncate min-w-0"
          style={{
            fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
            color: "var(--tc-accent-dark)",
            letterSpacing: "-0.02em",
          }}
        >
          {caseInfo ? `${caseInfo.name} · ${caseInfo.age}세` : "상담 세션"}
        </h1>
        {/* 아바타 태그 — 태블릿 이상에서만 (모바일은 공간 절약) */}
        {avatarType === "heygen" && (
          <span className="tc-tag tc-tag-cream hidden md:inline-flex">HeyGen Interactive</span>
        )}
        {avatarType === "simli" && (
          <span className="tc-tag tc-tag-cream hidden md:inline-flex">Simli</span>
        )}
        {avatarType === "deepbrain" && (
          <span className="tc-tag tc-tag-blue hidden md:inline-flex">DeepBrain AI Human</span>
        )}
        <Badge variant="outline" className="gap-1.5 text-xs ml-auto flex-shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${getStatusColor(ws.status)}`}
          />
          <span className="hidden sm:inline">{getStatusText(ws.status)}</span>
          <span className="sm:hidden">
            {ws.status === "connected" ? "ON" : ws.status === "connecting" ? "..." : "OFF"}
          </span>
        </Badge>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 p-3 sm:p-4 lg:h-[calc(100vh-57px)]">
        {/* 왼쪽: 아바타 + 마이크 + 대시보드 */}
        <div className="flex-1 flex flex-col items-center gap-3 sm:gap-4 lg:overflow-y-auto lg:pr-1 min-w-0">
          <AvatarView
            avatarType={avatarType}
            vrm={avatarType === "vrm" ? vrmAvatar.vrmRef.current : undefined}
            controllers={avatarType === "vrm" ? vrmAvatar.controllers : undefined}
            videoRef={
              avatarType === "heygen"
                ? heygenAvatar.videoRef
                : avatarType === "simli"
                  ? simliAvatar.videoRef
                  : undefined
            }
            audioRef={
              avatarType === "heygen"
                ? heygenAvatar.audioRef
                : avatarType === "simli"
                  ? simliAvatar.audioRef
                  : undefined
            }
            containerRef={avatarType === "deepbrain" ? deepbrainAvatar.containerRef : undefined}
            isLoading={avatar.isLoading}
            isInitialized={avatar.isInitialized}
            error={avatar.error}
            currentEmotion={currentEmotion}
            emotionIntensity={emotionIntensity}
          />

          {/* 큰 컨트롤 바: 감정 표시 + 시작/종료 버튼 */}
          <div
            className="w-full max-w-2xl mx-auto rounded-[14px] border px-4 sm:px-5 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
            style={{
              background: "var(--tc-card-white)",
              borderColor: "var(--tc-border)",
            }}
          >
            {/* 내담자 감정 표시 (크게) */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <span
                className="text-[10px] font-bold tracking-[0.16em] uppercase whitespace-nowrap"
                style={{ color: "var(--tc-text-muted)" }}
              >
                내담자 감정
              </span>
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="text-[28px] leading-none transition-all"
                  style={{
                    opacity: isSessionActive
                      ? 0.6 + emotionIntensity * 0.4
                      : 0.35,
                  }}
                >
                  {(EMOTION_MAP[currentEmotion] ?? EMOTION_MAP.neutral).emoji}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[15px] font-bold leading-tight"
                    style={{
                      fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
                      color: isSessionActive
                        ? "var(--tc-accent-dark)"
                        : "var(--tc-text-muted)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {(EMOTION_MAP[currentEmotion] ?? EMOTION_MAP.neutral).label}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className="w-[80px] h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--tc-soft-bg)" }}
                    >
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.round(emotionIntensity * 100)}%`,
                          background: isSessionActive
                            ? "linear-gradient(90deg, var(--tc-accent-light), var(--tc-accent))"
                            : "var(--tc-border-warm)",
                        }}
                      />
                    </div>
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: "var(--tc-text-sec)" }}
                    >
                      {Math.round(emotionIntensity * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 시작/종료 버튼 (크게) — 모바일에선 풀폭 */}
            {!isSessionActive ? (
              <button
                onClick={handleStartSession}
                disabled={avatar.isLoading}
                className="w-full sm:w-auto px-6 sm:px-7 py-3 rounded-full text-[14.5px] font-bold transition-all hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_4px_14px_rgba(60,40,23,0.18)]"
                style={{
                  background: "var(--tc-accent-dark)",
                  color: "#fff",
                  fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
                  letterSpacing: "-0.01em",
                }}
              >
                <span className="text-[16px]">▶</span>
                <span>{avatar.isLoading ? "연결 중..." : "상담 시작"}</span>
              </button>
            ) : (
              <button
                onClick={handleStopSession}
                className="w-full sm:w-auto px-6 py-3 rounded-full text-[13.5px] font-semibold transition-colors hover:bg-[var(--tc-soft-bg)] flex items-center justify-center gap-2 whitespace-nowrap"
                style={{
                  background: "var(--tc-card-white)",
                  color: "var(--tc-accent-dark)",
                  border: "1.5px solid var(--tc-border-warm)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--tc-red)" }}
                />
                상담 종료
              </button>
            )}
          </div>

          {/* 마이크 컨트롤 */}
          <div className="flex flex-col items-center gap-2">
            {sttAvailable ? (
              <>
                <MicButton
                  isRecording={mic.isRecording}
                  isConnected={ws.isConnected}
                  onToggle={handleMicToggle}
                  disabled={!isSessionActive}
                />
                <p className="text-xs text-muted-foreground">
                  {mic.isRecording
                    ? "듣고 있어요..."
                    : isSessionActive
                      ? "마이크를 눌러 상담하세요"
                      : "상담을 시작해주세요"}
                </p>
                {mic.error && (
                  <p className="text-xs text-red-500">{mic.error}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                음성 인식 비활성 — 텍스트로 대화하세요
              </p>
            )}
          </div>

          {/* 텍스트 입력 */}
          {isSessionActive && (
            <div className="flex w-full max-w-md gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                placeholder="상담사로서 응답하세요..."
                disabled={isThinking}
                className="flex-1"
              />
              <Button
                onClick={handleSendText}
                disabled={!textInput.trim() || isThinking}
                size="sm"
              >
                전송
              </Button>
            </div>
          )}

          {/* 회기 목표 + 수행 현황 대시보드 */}
          <div className="w-full max-w-2xl mx-auto pt-2">
            <SessionDashboard
              sessionGoals={caseInfo?.session_goals ?? []}
              messages={messages}
              sessionStartedAt={sessionStartedAt}
              isSessionActive={isSessionActive}
            />
          </div>
        </div>

        {/* 오른쪽: 채팅 패널 — 모바일은 고정 높이, lg 이상은 가로 컬럼 */}
        <div className="w-full lg:w-96 h-[420px] lg:h-full flex-shrink-0">
          <ChatPanel
            messages={messages}
            partialTranscript={partialTranscript}
            isThinking={isThinking}
          />
        </div>
      </div>
    </main>
  );
}
