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
  private validExpressions: Set<string> = new Set();
  private logCount = 0;

  constructor(vrm: VRM) {
    this.vrm = vrm;

    // VRM 모델에 실제로 존재하는 expression만 사용
    const manager = vrm.expressionManager;
    if (manager) {
      for (const expr of manager.expressions) {
        this.validExpressions.add(expr.expressionName);
      }
    }

    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.currentValues[name] = 0;
      this.targetValues[name] = 0;
      if (!this.validExpressions.has(name)) {
        console.warn(`[Expression] VRM 모델에 "${name}" 표정 없음. 사용 가능: ${[...this.validExpressions].join(", ")}`);
      }
    }
  }

  setEmotion(emotion: EmotionType, intensity: number): void {
    const template = EMOTION_TO_VRM[emotion] || EMOTION_TO_VRM.neutral;
    console.log(`[Expression] setEmotion: ${emotion}, intensity: ${intensity.toFixed(2)}`);
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.targetValues[name] = (template[name] || 0) * intensity;
    }
  }

  update(delta: number): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;

    for (const name of ALL_EMOTION_EXPRESSIONS) {
      if (!this.validExpressions.has(name)) continue;

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

    // 처음 5프레임만 디버그 로깅 (과도한 로깅 방지)
    if (this.logCount < 5) {
      const active = ALL_EMOTION_EXPRESSIONS.filter(n => this.currentValues[n] > 0.01);
      if (active.length > 0) {
        console.log(`[Expression] 활성: ${active.map(n => `${n}=${this.currentValues[n].toFixed(2)}`).join(", ")}`);
        this.logCount++;
      }
    }
  }

  dispose(): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      if (this.validExpressions.has(name)) {
        expressions.setValue(name, 0);
      }
    }
  }
}
