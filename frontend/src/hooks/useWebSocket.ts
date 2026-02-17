"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage, ClientMessage, ConnectionStatus } from "@/lib/types";
import { WS_URL } from "@/lib/constants";

interface UseWebSocketOptions {
  onMessage?: (message: ServerMessage) => void;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, autoConnect = false } = options;
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback((caseId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const url = caseId ? `${WS_URL}?case_id=${encodeURIComponent(caseId)}` : WS_URL;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("connected");
      console.log("[WS] 연결됨");
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        onMessageRef.current?.(message);
      } catch (e) {
        console.error("[WS] 메시지 파싱 오류:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] 오류:", error);
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      console.log("[WS] 연결 종료");
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudio = useCallback(
    (audioBase64: string) => {
      sendMessage({ type: "audio", data: audioBase64 });
    },
    [sendMessage]
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
    sendMessage,
    sendAudio,
    isConnected: status === "connected",
  };
}
