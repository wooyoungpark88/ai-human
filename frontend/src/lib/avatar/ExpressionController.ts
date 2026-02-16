import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType } from "@/lib/types";

type ExpressionTarget = Record<string, number>;

// 상담사 감정 매핑: 다중 블렌드셰이프 조합, 절제된 강도
const EMOTION_TO_VRM: Record<EmotionType, ExpressionTarget> = {
  neutral:    { happy: 0.1,  relaxed: 0.4 },
  happy:      { happy: 0.6,  relaxed: 0.2 },
  sad:        { sad: 0.5,    relaxed: 0.1 },
  angry:      { angry: 0.3,  sad: 0.15 },
  surprised:  { surprised: 0.45, happy: 0.15, relaxed: 0.1 },
  thinking:   { relaxed: 0.3, sad: 0.08, surprised: 0.05, ou: 0.12 },
  anxious:    { sad: 0.25, surprised: 0.15, relaxed: 0.05, happy: 0.05 },
  empathetic: { happy: 0.25, sad: 0.2, relaxed: 0.35 },
};

const ALL_EMOTION_EXPRESSIONS = [
  "happy", "sad", "angry", "surprised", "relaxed",
  "aa", "ih", "ou", "ee", "oh",
];

const MOUTH_EXPRESSIONS = new Set(["aa", "ih", "ou", "ee", "oh"]);

// 지수 스무딩 설정
const ONSET_SPEED = 1.2;   // 표정 나타남 (~1.5초에 90%)
const OFFSET_SPEED = 0.8;  // 표정 사라짐 (~2.2초에 10%)

// 미세표정 호흡
const BREATHING_SPEED = 0.4;
const BREATHING_AMPLITUDE = 0.03;
const PHASE_OFFSETS: Record<string, number> = {
  happy: 0, sad: 1.2, angry: 2.4, surprised: 3.6,
  relaxed: 0.8, ou: 1.8, aa: 2.0, ih: 3.0, ee: 4.0, oh: 5.0,
};

// 아이들 표정 변화
const IDLE_VARIATIONS: ExpressionTarget[] = [
  { happy: 0.18, relaxed: 0.35 },
  { happy: 0.05, relaxed: 0.45, sad: 0.05 },
  { happy: 0.1, relaxed: 0.4 },
  { happy: 0.12, relaxed: 0.3, surprised: 0.05 },
  { relaxed: 0.35 },
];

const IDLE_COOLDOWN = 8;           // 마지막 감정 후 아이들 시작까지 대기(초)
const IDLE_INTERVAL_MIN = 4;
const IDLE_INTERVAL_MAX = 7;

export class ExpressionController {
  private vrm: VRM;
  private currentValues: Record<string, number> = {};
  private targetValues: Record<string, number> = {};
  private validExpressions: Set<string> = new Set();
  private lipSyncActive = false;
  private breathingPhase = 0;
  private idleTimer = 0;
  private idleVariationInterval = IDLE_INTERVAL_MIN + Math.random() * (IDLE_INTERVAL_MAX - IDLE_INTERVAL_MIN);
  private lastEmotionSetTime = 0;
  private elapsedTime = 0;

  constructor(vrm: VRM) {
    this.vrm = vrm;

    const manager = vrm.expressionManager;
    if (manager) {
      for (const expr of manager.expressions) {
        this.validExpressions.add(expr.expressionName);
      }
    }

    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.currentValues[name] = 0;
      this.targetValues[name] = 0;
    }

    // 초기 상태: 따뜻한 기본 표정
    const neutral = EMOTION_TO_VRM.neutral;
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.targetValues[name] = neutral[name] ?? 0;
    }
  }

  setEmotion(emotion: EmotionType, intensity: number): void {
    const template = EMOTION_TO_VRM[emotion] || EMOTION_TO_VRM.neutral;
    // 상담사 매핑이 이미 절제된 값이므로 하한 보정
    const adjusted = 0.4 + intensity * 0.6;
    console.log(`[Expression] setEmotion: ${emotion}, intensity: ${intensity.toFixed(2)} → adjusted: ${adjusted.toFixed(2)}`);
    for (const name of ALL_EMOTION_EXPRESSIONS) {
      this.targetValues[name] = (template[name] || 0) * adjusted;
    }
    this.lastEmotionSetTime = this.elapsedTime;
  }

  setLipSyncActive(active: boolean): void {
    this.lipSyncActive = active;
  }

  updateIdle(delta: number, elapsedTime: number): void {
    this.elapsedTime = elapsedTime;

    // 최근 감정 설정이 있으면 아이들 변화 하지 않음
    if (elapsedTime - this.lastEmotionSetTime < IDLE_COOLDOWN) return;

    this.idleTimer += delta;
    if (this.idleTimer >= this.idleVariationInterval && this.isNearBaseline()) {
      this.idleTimer = 0;
      this.idleVariationInterval = IDLE_INTERVAL_MIN + Math.random() * (IDLE_INTERVAL_MAX - IDLE_INTERVAL_MIN);
      const variation = IDLE_VARIATIONS[Math.floor(Math.random() * IDLE_VARIATIONS.length)];
      for (const name of ALL_EMOTION_EXPRESSIONS) {
        this.targetValues[name] = variation[name] ?? 0;
      }
    }
  }

  update(delta: number): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;

    // 미세표정 호흡 위상 업데이트
    this.breathingPhase += delta * BREATHING_SPEED * Math.PI * 2;
    if (this.breathingPhase > Math.PI * 2) this.breathingPhase -= Math.PI * 2;

    for (const name of ALL_EMOTION_EXPRESSIONS) {
      if (!this.validExpressions.has(name)) continue;
      if (this.lipSyncActive && MOUTH_EXPRESSIONS.has(name)) continue;

      const target = this.targetValues[name] ?? 0;
      const current = this.currentValues[name] ?? 0;
      const diff = target - current;

      if (Math.abs(diff) < 0.001) {
        this.currentValues[name] = target;
      } else {
        // onset/offset 비대칭 지수 스무딩
        const isOnset = Math.abs(target) > Math.abs(current);
        const speed = isOnset ? ONSET_SPEED : OFFSET_SPEED;
        const smoothFactor = 1.0 - Math.exp(-speed * delta);
        this.currentValues[name] = current + diff * smoothFactor;
      }

      // 미세표정 호흡: 활성 표정에 사인파 진동 추가
      let finalValue = this.currentValues[name];
      if (finalValue > 0.05) {
        const phaseOffset = PHASE_OFFSETS[name] ?? 0;
        const breath = Math.sin(this.breathingPhase + phaseOffset)
          * BREATHING_AMPLITUDE * finalValue;
        finalValue = Math.max(0, Math.min(1, finalValue + breath));
      }

      expressions.setValue(name, finalValue);
    }
  }

  private isNearBaseline(): boolean {
    return ALL_EMOTION_EXPRESSIONS.reduce(
      (sum, n) => sum + (this.targetValues[n] ?? 0), 0
    ) < 0.8;
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
