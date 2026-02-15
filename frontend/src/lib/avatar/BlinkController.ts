import type { VRM } from "@pixiv/three-vrm";

/**
 * 자동 눈 깜빡임 컨트롤러
 * - 2~6초 랜덤 간격으로 자연스러운 깜빡임
 * - 닫기 0.06초, 열기 0.1초
 */
export class BlinkController {
  private vrm: VRM;
  private nextBlinkTime = 0;
  private blinkPhase: "idle" | "closing" | "opening" = "idle";
  private blinkProgress = 0;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.nextBlinkTime = 1 + Math.random() * 3;
  }

  update(delta: number, elapsedTime: number): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;

    if (this.blinkPhase === "idle") {
      if (elapsedTime >= this.nextBlinkTime) {
        this.blinkPhase = "closing";
        this.blinkProgress = 0;
      }
      return;
    }

    if (this.blinkPhase === "closing") {
      this.blinkProgress += delta / 0.06;
      if (this.blinkProgress >= 1) {
        this.blinkProgress = 1;
        this.blinkPhase = "opening";
      }
    } else if (this.blinkPhase === "opening") {
      this.blinkProgress -= delta / 0.1;
      if (this.blinkProgress <= 0) {
        this.blinkProgress = 0;
        this.blinkPhase = "idle";
        this.nextBlinkTime = elapsedTime + 2 + Math.random() * 4;
      }
    }

    expressions.setValue("blink", this.blinkProgress);
  }

  dispose(): void {
    this.vrm.expressionManager?.setValue("blink", 0);
  }
}
