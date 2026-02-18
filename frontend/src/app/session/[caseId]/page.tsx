"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AvatarView } from "@/components/AvatarView";
import { ChatPanel } from "@/components/ChatPanel";
import { EmotionBadge } from "@/components/EmotionBadge";
import { MicButton } from "@/components/MicButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useVRMAvatar } from "@/hooks/useVRMAvatar";
import { useVideoAvatar } from "@/hooks/useVideoAvatar";
import { useSimliAvatar } from "@/hooks/useSimliAvatar";
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

  // Refs
  const messageIdRef = useRef(0);
  const partialTranscriptRef = useRef("");
  const conversationPhaseRef = useRef<ConversationPhase>("idle");

  // 아바타 타입 결정 (케이스 정보에서)
  const avatarType: AvatarType = caseInfo?.avatar_type || "vrm";

  // 모든 아바타 훅 호출 (React 훅 규칙: 조건부 호출 불가)
  const vrmAvatar = useVRMAvatar();
  const videoAvatar = useVideoAvatar({
    agentId: caseInfo?.bp_agent_id || undefined,
  });
  const simliAvatar = useSimliAvatar({
    faceId: caseInfo?.simli_face_id || undefined,
  });

  // 활성 아바타 선택
  const avatar = useMemo(() => {
    if (avatarType === "video") {
      return {
        isInitialized: videoAvatar.isInitialized,
        isLoading: videoAvatar.isLoading,
        error: videoAvatar.error,
        initialize: videoAvatar.initialize,
        sendBase64Audio: videoAvatar.sendBase64Audio,
        setEmotion: videoAvatar.setEmotion,
        setConversationPhase: videoAvatar.setConversationPhase,
        close: videoAvatar.close,
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
  }, [avatarType, vrmAvatar, videoAvatar, simliAvatar]);

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
    [avatar]
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
    if (avatarType === "video") {
      // BP Managed Agent: STT만 사용 (LLM/TTS는 BP 내장 파이프라인)
      ws.connect(caseId, "stt_only");
    } else {
      ws.connect(caseId);
    }
    await avatar.initialize();
    setIsThinking(false);
    setIsSpeaking(false);
    conversationPhaseRef.current = "idle";
    avatar.setConversationPhase("idle");
    setIsSessionActive(true);
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
    <main className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/cases"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; 케이스 목록
          </Link>
          <h1 className="text-lg font-bold">
            {caseInfo ? `${caseInfo.name} (${caseInfo.age}세)` : "상담 세션"}
          </h1>
          {avatarType === "video" && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
              Beyond Presence
            </Badge>
          )}
          {avatarType === "simli" && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
              Simli
            </Badge>
          )}
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor(ws.status)}`}
            />
            {getStatusText(ws.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <EmotionBadge
            emotion={currentEmotion}
            intensity={emotionIntensity}
          />

          {!isSessionActive ? (
            <Button onClick={handleStartSession} size="sm">
              상담 시작
            </Button>
          ) : (
            <Button
              onClick={handleStopSession}
              variant="outline"
              size="sm"
            >
              상담 종료
            </Button>
          )}
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 h-[calc(100vh-57px)]">
        {/* 왼쪽: 아바타 + 마이크 */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <AvatarView
            avatarType={avatarType}
            vrm={avatarType === "vrm" ? vrmAvatar.vrmRef.current : undefined}
            controllers={avatarType === "vrm" ? vrmAvatar.controllers : undefined}
            videoRef={avatarType === "video" ? videoAvatar.videoRef : avatarType === "simli" ? simliAvatar.videoRef : undefined}
            audioRef={avatarType === "video" ? videoAvatar.audioRef : avatarType === "simli" ? simliAvatar.audioRef : undefined}
            isLoading={avatar.isLoading}
            isInitialized={avatar.isInitialized}
            error={avatar.error}
            currentEmotion={currentEmotion}
            emotionIntensity={emotionIntensity}
          />

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
        </div>

        {/* 오른쪽: 채팅 패널 */}
        <div className="w-full lg:w-96 h-full">
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
