import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType } from "@/lib/types";

/**
 * 감정 → VRM 블렌드셰이프 매핑 + 스무딩 전환
 */

type ExpressionTarget = Record<string, number>;

const EMOTION_TO_VRM: Record<EmotionType, ExpressionTarget> = {
  neutral: { relaxed: 0.3 },
  happy: { happy: 1.0 },
  sad: { sad: 1.0 },
  angry: { angry: 1.0 },
  surprised: { surprised: 1.0 },
  thinking: { relaxed: 0.2 },
  anxious: { sad: 0.3, surprised: 0.2 },
  empathetic: { happy: 0.3, sad: 0.2, relaxed: 0.3 },
};

const ALL_EMOTION_EXPRESSIONS = ["happy", "sad", "angry", "surprised", "relaxed"];

export class ExpressionController {
  private vrm: VRM;
  private currentValues: Record<string, number> = {};
  private targetValues: Record<string, number> = {};
  private transitionSpeed = 3.0; // units/sec

  constructor(vrm: VRM) {
    this.vrm = vrm;
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.currentValues[name] = 0;
      this.targetValues[name] = 0;
    }
  }

  setEmotion(emotion: EmotionType, intensity: number): void {
    const template = EMOTION_TO_VRM[emotion] || EMOTION_TO_VRM.neutral;
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.targetValues[name] = (template[name] || 0) * intensity;
    }
  }

  update(delta: number): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;

    for (const name of ALL_EMOTION_EXPRESSIONS) {
      const target = this.targetValues[name] ?? 0;
      const current = this.currentValues[name] ?? 0;
      const diff = target - current;

      if (Math.abs(diff) < 0.001) {
        this.currentValues[name] = target;
      } else {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), this.transitionSpeed * delta);
        this.currentValues[name] = current + step;
      }

      expressions.setValue(name, this.currentValues[name]);
    }
  }

  dispose(): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      expressions.setValue(name, 0);
    }
  }
}
