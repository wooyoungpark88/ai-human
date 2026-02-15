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
import { useSimli } from "@/hooks/useSimli";
import type {
  ChatMessage,
  EmotionType,
  ServerMessage,
  ConnectionStatus,
} from "@/lib/types";
import { API_URL } from "@/lib/constants";

interface ProfileInfo {
  id: string;
  name: string;
  description: string;
}

export default function Home() {
  // 상태 관리
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("neutral");
  const [emotionIntensity, setEmotionIntensity] = useState(0.5);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("default");
  const [textInput, setTextInput] = useState("");
  const [sttAvailable, setSttAvailable] = useState(true);
  const [userName, setUserName] = useState("");

  // Refs
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const messageIdRef = useRef(0);
  const partialTranscriptRef = useRef("");

  // Simli 아바타 훅
  const simli = useSimli();

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

  // 프로필 목록 로드 (백엔드 API)
  useEffect(() => {
    async function loadProfiles() {
      try {
        const res = await fetch(`${API_URL}/api/profiles`);
        const json = await res.json();
        if (json.profiles) setProfiles(json.profiles);
      } catch (err) {
        console.warn("프로필 목록 로드 실패:", err);
      }
    }
    loadProfiles();
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
            simli.sendBase64Audio(message.audio_data);
          }
          break;

        case "emotion":
          if (message.emotion) {
            setCurrentEmotion(message.emotion as EmotionType);
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
    [simli]
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
    // 1. WebSocket 연결
    ws.connect();

    // 2. Simli 아바타 초기화
    if (videoElRef.current && audioElRef.current) {
      await simli.initialize(videoElRef.current, audioElRef.current);
    }

    setIsSessionActive(true);
  }, [ws, simli]);

  // 세션 종료
  const handleStopSession = useCallback(() => {
    mic.stopRecording();
    ws.sendMessage({ type: "stop" });
    ws.disconnect();
    simli.close();
    setIsSessionActive(false);
    setIsThinking(false);
    setPartialTranscript("");
  }, [mic, ws, simli]);

  // 프로필 변경
  const handleProfileChange = useCallback(
    (profileId: string) => {
      setSelectedProfile(profileId);
      if (ws.isConnected) {
        ws.sendMessage({ type: "config", profile_id: profileId });
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
          <h1 className="text-lg font-bold">AI Avatar</h1>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor(ws.status)}`}
            />
            {getStatusText(ws.status)}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* 프로필 선택 */}
          {profiles.length > 0 && (
            <Select
              value={selectedProfile}
              onValueChange={handleProfileChange}
              disabled={isSessionActive}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="프로필 선택" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
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
              대화 시작
            </Button>
          ) : (
            <Button
              onClick={handleStopSession}
              variant="outline"
              size="sm"
            >
              대화 종료
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
            onVideoRef={(el) => {
              videoElRef.current = el;
            }}
            onAudioRef={(el) => {
              audioElRef.current = el;
            }}
            isLoading={simli.isLoading}
            isInitialized={simli.isInitialized}
            error={simli.error}
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
                      ? "마이크를 눌러 말하세요"
                      : "대화를 시작해주세요"}
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
                placeholder="메시지를 입력하세요..."
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
