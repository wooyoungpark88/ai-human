"use client";

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EMOTION_MAP } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  partialTranscript?: string;
  isThinking?: boolean;
}

export function ChatPanel({
  messages,
  partialTranscript,
  isThinking = false,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partialTranscript, isThinking]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold text-foreground">대화 기록</h2>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && !partialTranscript && (
            <p className="text-center text-muted-foreground text-sm py-8">
              대화를 시작해보세요.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>

                <div className="flex items-center gap-2 mt-1">
                  {msg.emotion && msg.role === "assistant" && (
                    <span className="text-xs opacity-70">
                      {EMOTION_MAP[msg.emotion]?.emoji}
                    </span>
                  )}
                  <span className="text-[10px] opacity-50">
                    {msg.timestamp.toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* 실시간 트랜스크립트 (사용자 발화 중) */}
          {partialTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-primary/50 text-primary-foreground rounded-br-md">
                <p className="text-sm leading-relaxed italic">
                  {partialTranscript}
                </p>
              </div>
            </div>
          )}

          {/* 생각 중 인디케이터 */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </Card>
  );
}
