"use client";

import { Badge } from "@/components/ui/badge";
import { EMOTION_MAP } from "@/lib/constants";
import type { EmotionType } from "@/lib/types";

interface EmotionBadgeProps {
  emotion: EmotionType;
  intensity?: number;
  showLabel?: boolean;
}

export function EmotionBadge({
  emotion,
  intensity = 0.5,
  showLabel = true,
}: EmotionBadgeProps) {
  const info = EMOTION_MAP[emotion] || EMOTION_MAP.neutral;

  return (
    <Badge
      variant="secondary"
      className={`${info.color} transition-all duration-500 ease-in-out text-xs px-3 py-1`}
      style={{
        opacity: 0.5 + intensity * 0.5,
      }}
    >
      <span className="mr-1">{info.emoji}</span>
      {showLabel && <span>{info.label}</span>}
      {intensity > 0 && (
        <span className="ml-1.5 opacity-60 text-[10px]">
          {Math.round(intensity * 100)}%
        </span>
      )}
    </Badge>
  );
}
