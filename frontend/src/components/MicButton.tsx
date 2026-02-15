"use client";

import { Button } from "@/components/ui/button";

interface MicButtonProps {
  isRecording: boolean;
  isConnected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function MicButton({
  isRecording,
  isConnected,
  onToggle,
  disabled = false,
}: MicButtonProps) {
  return (
    <Button
      variant={isRecording ? "destructive" : "default"}
      size="lg"
      onClick={onToggle}
      disabled={disabled || !isConnected}
      className={`relative rounded-full w-16 h-16 p-0 transition-all duration-300 ${
        isRecording ? "scale-110" : "hover:scale-105"
      }`}
    >
      {/* 녹음 중 펄스 애니메이션 */}
      {isRecording && (
        <>
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
          <span className="absolute inset-[-4px] rounded-full border-2 border-red-400 animate-pulse" />
        </>
      )}

      {/* 마이크 아이콘 */}
      <svg
        className="w-6 h-6 relative z-10"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {isRecording ? (
          // 정지 아이콘
          <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth={2} />
        ) : (
          // 마이크 아이콘
          <>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 10v2a7 7 0 0 1-14 0v-2"
            />
            <line
              x1="12"
              y1="19"
              x2="12"
              y2="23"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1="8"
              y1="23"
              x2="16"
              y2="23"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </Button>
  );
}
