"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarView } from "@/components/AvatarView";
import { ChatPanel } from "@/components/ChatPanel";
import { EmotionBadge } from "@/components/EmotionBadge";
import { MicButton } from "@/components/MicButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useVRMAvatar } from "@/hooks/useVRMAvatar";
import type {
  ChatMessage,
  EmotionType,
  ServerMessage,
  ConnectionStatus,
  CaseInfo,
} from "@/lib/types";
import { API_URL } from "@/lib/constants";

export default function Home() {
  // 상태 관리
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("neutral");
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [selectedCase, setSelectedCase] = useState("burnout_beginner");
  const [textInput, setTextInput] = useState("");
  const [sttAvailable, setSttAvailable] = useState(true);
  const [userName, setUserName] = useState("");

  // Refs
  const messageIdRef = useRef(0);
  const partialTranscriptRef = useRef("");

  // VRM 아바타 훅
  const avatar = useVRMAvatar();

  // 사용자 정보 로드 (쿠키 세션)
  useEffect(() => {
    const session = document.cookie
      .split("; ")
      .find((c) => c.startsWith("session="))
      ?.split("=")[1];
    if (session) {
      try { setUserName(atob(session)); } catch { /* ignore */ }
    }
  }, []);

  // 케이스 목록 로드 (백엔드 API)
  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch(`${API_URL}/api/cases`);
        const json = await res.json();
        if (json.cases) setCases(json.cases);
      } catch (err) {
        console.warn("케이스 목록 로드 실패:", err);
      }
    }
    loadCases();
  }, []);

  // partialTranscript ref 동기화
  useEffect(() => {
    partialTranscriptRef.current = partialTranscript;
  }, [partialTranscript]);

  // WebSocket 메시지 핸들러
  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "transcript":
          if (message.is_final && message.text) {
            setPartialTranscript("");
            partialTranscriptRef.current = "";
          } else if (message.text) {
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
            avatar.sendBase64Audio(message.audio_data);
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
            // ref를 사용하여 stale closure 방지
            const currentTranscript = partialTranscriptRef.current;
            if (currentTranscript) {
              const msgId = `msg-${++messageIdRef.current}`;
              setMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  role: "user",
                  text: currentTranscript,
                  timestamp: new Date(),
                },
              ]);
              setPartialTranscript("");
              partialTranscriptRef.current = "";
            }
          } else if (message.text === "stt_unavailable") {
            setSttAvailable(false);
          }
          break;

        case "error":
          console.error("[Server Error]", message.text);
          setIsThinking(false);
          break;
      }
    },
    [avatar]
  );

  // WebSocket 훅
  const ws = useWebSocket({ onMessage: handleServerMessage });

  // 마이크 훅 - 오디오 데이터를 WebSocket으로 전송
  const mic = useMicrophone({
    onAudioData: (base64Data) => {
      ws.sendAudio(base64Data);
    },
  });

  // 세션 시작
  const handleStartSession = useCallback(async () => {
    // 1. WebSocket 연결 (선택된 케이스 ID를 쿼리 파라미터로 전달)
    ws.connect(selectedCase);

    // 2. VRM 아바타 초기화
    await avatar.initialize();

    setIsSessionActive(true);
  }, [ws, avatar, selectedCase]);

  // 세션 종료
  const handleStopSession = useCallback(() => {
    mic.stopRecording();
    ws.sendMessage({ type: "stop" });
    ws.disconnect();
    avatar.close();
    setIsSessionActive(false);
    setIsThinking(false);
    setPartialTranscript("");
  }, [mic, ws, avatar]);

  // 케이스 변경
  const handleCaseChange = useCallback(
    (caseId: string) => {
      setSelectedCase(caseId);
      if (ws.isConnected) {
        ws.sendMessage({ type: "config", case_id: caseId });
        setMessages([]);
      }
    },
    [ws]
  );

  // 텍스트 메시지 전송
  const handleSendText = useCallback(() => {
    const text = textInput.trim();
    if (!text || !ws.isConnected) return;

    // 사용자 메시지 추가
    const msgId = `msg-${++messageIdRef.current}`;
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: "user", text, timestamp: new Date() },
    ]);

    // 서버로 전송
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

  // 로그아웃
  const handleLogout = useCallback(() => {
    document.cookie = "session=; path=/; max-age=0";
    window.location.href = "/login";
  }, []);

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

  return (
    <main className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">AI 상담 훈련</h1>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor(ws.status)}`}
            />
            {getStatusText(ws.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* 내담자 케이스 선택 */}
          {cases.length > 0 && (
            <Select
              value={selectedCase}
              onValueChange={handleCaseChange}
              disabled={isSessionActive}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="내담자 선택" />
              </SelectTrigger>
              <SelectContent>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.age}세) - {c.presenting_issue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

          {userName && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {userName}
            </span>
          )}
          <Button onClick={handleLogout} variant="ghost" size="sm">
            로그아웃
          </Button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 h-[calc(100vh-57px)]">
        {/* 왼쪽: 아바타 + 마이크 */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <AvatarView
            vrm={avatar.vrmRef.current}
            controllers={avatar.controllers}
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
                ⚠️ 음성 인식 비활성 — 텍스트로 대화하세요
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
