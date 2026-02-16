import type { VRM } from "@pixiv/three-vrm";
import type { ExpressionController } from "./ExpressionController";

/**
 * FFT 기반 립싱크 컨트롤러
 * - AnalyserNode에서 주파수 데이터를 읽어 VRM viseme 제어
 * - 음성 주파수 범위(85-3000Hz)의 평균 에너지로 입 벌림 정도 결정
 * - ExpressionController와 연동하여 입 블렌드셰이프 충돌 방지
 */
export class LipSyncController {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private vrm: VRM;
  private smoothedValue = 0;
  private expressionController: ExpressionController | null;

  constructor(vrm: VRM, analyser: AnalyserNode, expressionController?: ExpressionController) {
    this.vrm = vrm;
    this.analyser = analyser;
    this.dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.expressionController = expressionController ?? null;
  }

  update(_delta: number): void {
    this.analyser.getByteFrequencyData(this.dataArray);

    // fftSize=256 → frequencyBinCount=128
    // sampleRate=16000 → bin resolution = 16000/256 = 62.5 Hz/bin
    // 음성 범위 85-3000Hz → bin 1~48
    const voiceBins = this.dataArray.slice(1, 48);
    let sum = 0;
    for (let i = 0; i < voiceBins.length; i++) {
      sum += voiceBins[i];
    }
    const avg = sum / voiceBins.length;
    const normalized = Math.min(1.0, avg / 140);

    // 스무딩
    const smoothing = 0.55;
    this.smoothedValue = this.smoothedValue * smoothing + normalized * (1 - smoothing);

    const expressions = this.vrm.expressionManager;
    if (!expressions) return;

    const mouthOpen = this.smoothedValue;
    const isActive = mouthOpen > 0.03;

    // ExpressionController에 립싱크 활성 상태 전달
    this.expressionController?.setLipSyncActive(isActive);

    // 주 viseme: aa (입 크게 벌림), 보조: oh (둥근 입)
    if (isActive) {
      expressions.setValue("aa", mouthOpen * 0.9);
      expressions.setValue("oh", mouthOpen * 0.3);
    } else {
      expressions.setValue("aa", 0);
      expressions.setValue("oh", 0);
    }
  }

  dispose(): void {
    const expressions = this.vrm.expressionManager;
    if (!expressions) return;
    for (const v of ["aa", "ih", "ou", "ee", "oh"]) {
      expressions.setValue(v, 0);
    }
  }
}
