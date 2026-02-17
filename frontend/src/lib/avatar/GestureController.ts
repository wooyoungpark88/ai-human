import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType } from "@/lib/types";

/**
 * 팔/어깨 제스처 정의 (라디안)
 */
interface ArmPose {
  leftShoulder: { z: number };
  leftUpperArm: { z: number; x: number };
  leftLowerArm: { z: number; x: number };
  rightShoulder: { z: number };
  rightUpperArm: { z: number; x: number };
  rightLowerArm: { z: number; x: number };
}

/**
 * 감정별 제스처 매핑
 * - neutral: 자연스러운 휴식 자세 (팔을 자연스럽게 내림)
 * - 각 감정은 미묘하지만 구별 가능한 차이
 */
const EMOTION_GESTURES: Record<EmotionType, ArmPose> = {
  neutral: {
    leftShoulder: { z: 0.15 },
    leftUpperArm: { z: 1.5, x: 0.2 },
    leftLowerArm: { z: -0.3, x: 0 },
    rightShoulder: { z: -0.15 },
    rightUpperArm: { z: -1.5, x: 0.2 },
    rightLowerArm: { z: 0.3, x: 0 },
  },
  happy: {
    leftShoulder: { z: 0.08 },
    leftUpperArm: { z: 1.2, x: 0.15 },
    leftLowerArm: { z: -0.2, x: 0 },
    rightShoulder: { z: -0.08 },
    rightUpperArm: { z: -1.2, x: 0.15 },
    rightLowerArm: { z: 0.2, x: 0 },
  },
  sad: {
    leftShoulder: { z: 0.25 },
    leftUpperArm: { z: 1.6, x: 0.3 },
    leftLowerArm: { z: -0.35, x: 0.05 },
    rightShoulder: { z: -0.25 },
    rightUpperArm: { z: -1.6, x: 0.3 },
    rightLowerArm: { z: 0.35, x: 0.05 },
  },
  angry: {
    leftShoulder: { z: 0.2 },
    leftUpperArm: { z: 1.25, x: 0.25 },
    leftLowerArm: { z: -0.4, x: 0.1 },
    rightShoulder: { z: -0.2 },
    rightUpperArm: { z: -1.25, x: 0.25 },
    rightLowerArm: { z: 0.4, x: 0.1 },
  },
  surprised: {
    leftShoulder: { z: 0.0 },
    leftUpperArm: { z: 1.1, x: 0.15 },
    leftLowerArm: { z: -0.15, x: -0.1 },
    rightShoulder: { z: 0.0 },
    rightUpperArm: { z: -1.1, x: 0.15 },
    rightLowerArm: { z: 0.15, x: -0.1 },
  },
  thinking: {
    leftShoulder: { z: 0.15 },
    leftUpperArm: { z: 1.5, x: 0.2 },
    leftLowerArm: { z: -0.3, x: 0 },
    rightShoulder: { z: -0.08 },
    rightUpperArm: { z: -0.95, x: 0.5 },
    rightLowerArm: { z: 0.5, x: 0.35 },
  },
  anxious: {
    leftShoulder: { z: 0.3 },
    leftUpperArm: { z: 1.5, x: 0.4 },
    leftLowerArm: { z: -0.4, x: 0.15 },
    rightShoulder: { z: -0.3 },
    rightUpperArm: { z: -1.5, x: 0.4 },
    rightLowerArm: { z: 0.4, x: 0.15 },
  },
  empathetic: {
    leftShoulder: { z: 0.1 },
    leftUpperArm: { z: 1.35, x: 0.2 },
    leftLowerArm: { z: -0.25, x: 0 },
    rightShoulder: { z: -0.1 },
    rightUpperArm: { z: -1.35, x: 0.2 },
    rightLowerArm: { z: 0.25, x: 0 },
  },
};

function lerpPose(a: ArmPose, b: ArmPose, t: number): ArmPose {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    leftShoulder: { z: lerp(a.leftShoulder.z, b.leftShoulder.z) },
    leftUpperArm: {
      z: lerp(a.leftUpperArm.z, b.leftUpperArm.z),
      x: lerp(a.leftUpperArm.x, b.leftUpperArm.x),
    },
    leftLowerArm: {
      z: lerp(a.leftLowerArm.z, b.leftLowerArm.z),
      x: lerp(a.leftLowerArm.x, b.leftLowerArm.x),
    },
    rightShoulder: { z: lerp(a.rightShoulder.z, b.rightShoulder.z) },
    rightUpperArm: {
      z: lerp(a.rightUpperArm.z, b.rightUpperArm.z),
      x: lerp(a.rightUpperArm.x, b.rightUpperArm.x),
    },
    rightLowerArm: {
      z: lerp(a.rightLowerArm.z, b.rightLowerArm.z),
      x: lerp(a.rightLowerArm.x, b.rightLowerArm.x),
    },
  };
}

/**
 * 제스처 컨트롤러
 * - 감정에 따른 팔/어깨 포즈 변화
 * - 부드러운 전환 애니메이션
 * - 미세 떨림/움직임으로 생동감
 */
export class GestureController {
  private vrm: VRM;
  private currentPose: ArmPose;
  private targetPose: ArmPose;
  private transitionSpeed = 1.5;
  private loggedOnce = false;

  // 미세 움직임 (손이 완전히 정지하지 않게)
  private fidgetPhase = Math.random() * Math.PI * 2;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.currentPose = JSON.parse(JSON.stringify(EMOTION_GESTURES.neutral));
    this.targetPose = JSON.parse(JSON.stringify(EMOTION_GESTURES.neutral));
    console.log("[Gesture] 제스처 컨트롤러 초기화");
  }

  setEmotion(emotion: EmotionType, intensity: number): void {
    const gesture = EMOTION_GESTURES[emotion] || EMOTION_GESTURES.neutral;
    const neutralGesture = EMOTION_GESTURES.neutral;
    const blend = 0.3 + intensity * 0.7;
    this.targetPose = lerpPose(neutralGesture, gesture, blend);
  }

  update(delta: number, elapsedTime: number): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    if (!this.loggedOnce) {
      this.loggedOnce = true;
      const lua = humanoid.getNormalizedBoneNode("leftUpperArm");
      const rua = humanoid.getNormalizedBoneNode("rightUpperArm");
      console.log("[Gesture] leftUpperArm bone:", lua ? "found" : "NULL",
        "| rightUpperArm bone:", rua ? "found" : "NULL",
        "| target L.z:", this.targetPose.leftUpperArm.z,
        "| target R.z:", this.targetPose.rightUpperArm.z);
    }

    this.fidgetPhase += delta;

    // 호흡 + 미세 떨림
    const breathIntensity = Math.sin(elapsedTime * 0.8) * 0.01;
    const fidgetL =
      Math.sin(this.fidgetPhase * 0.6 + 1.2) * 0.008 +
      Math.sin(this.fidgetPhase * 1.3 + 3.5) * 0.004;
    const fidgetR =
      Math.sin(this.fidgetPhase * 0.55 + 2.1) * 0.008 +
      Math.sin(this.fidgetPhase * 1.1 + 0.7) * 0.004;

    const smoothFactor = 1.0 - Math.exp(-this.transitionSpeed * delta);

    // 왼쪽
    const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
    if (leftShoulder) {
      this.currentPose.leftShoulder.z +=
        (this.targetPose.leftShoulder.z - this.currentPose.leftShoulder.z) *
        smoothFactor;
      leftShoulder.rotation.z = this.currentPose.leftShoulder.z;
    }

    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    if (leftUpperArm) {
      this.currentPose.leftUpperArm.z +=
        (this.targetPose.leftUpperArm.z - this.currentPose.leftUpperArm.z) *
        smoothFactor;
      this.currentPose.leftUpperArm.x +=
        (this.targetPose.leftUpperArm.x - this.currentPose.leftUpperArm.x) *
        smoothFactor;
      leftUpperArm.rotation.z =
        this.currentPose.leftUpperArm.z + breathIntensity + fidgetL;
      leftUpperArm.rotation.x = this.currentPose.leftUpperArm.x;
    }

    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
    if (leftLowerArm) {
      this.currentPose.leftLowerArm.z +=
        (this.targetPose.leftLowerArm.z - this.currentPose.leftLowerArm.z) *
        smoothFactor;
      this.currentPose.leftLowerArm.x +=
        (this.targetPose.leftLowerArm.x - this.currentPose.leftLowerArm.x) *
        smoothFactor;
      leftLowerArm.rotation.z = this.currentPose.leftLowerArm.z + fidgetL * 0.5;
      leftLowerArm.rotation.x = this.currentPose.leftLowerArm.x;
    }

    // 오른쪽
    const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
    if (rightShoulder) {
      this.currentPose.rightShoulder.z +=
        (this.targetPose.rightShoulder.z - this.currentPose.rightShoulder.z) *
        smoothFactor;
      rightShoulder.rotation.z = this.currentPose.rightShoulder.z;
    }

    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    if (rightUpperArm) {
      this.currentPose.rightUpperArm.z +=
        (this.targetPose.rightUpperArm.z - this.currentPose.rightUpperArm.z) *
        smoothFactor;
      this.currentPose.rightUpperArm.x +=
        (this.targetPose.rightUpperArm.x - this.currentPose.rightUpperArm.x) *
        smoothFactor;
      rightUpperArm.rotation.z =
        this.currentPose.rightUpperArm.z - breathIntensity + fidgetR;
      rightUpperArm.rotation.x = this.currentPose.rightUpperArm.x;
    }

    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
    if (rightLowerArm) {
      this.currentPose.rightLowerArm.z +=
        (this.targetPose.rightLowerArm.z - this.currentPose.rightLowerArm.z) *
        smoothFactor;
      this.currentPose.rightLowerArm.x +=
        (this.targetPose.rightLowerArm.x - this.currentPose.rightLowerArm.x) *
        smoothFactor;
      rightLowerArm.rotation.z =
        this.currentPose.rightLowerArm.z + fidgetR * 0.5;
      rightLowerArm.rotation.x = this.currentPose.rightLowerArm.x;
    }
  }

  dispose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const bones = [
      "leftShoulder",
      "leftUpperArm",
      "leftLowerArm",
      "rightShoulder",
      "rightUpperArm",
      "rightLowerArm",
    ] as const;

    for (const boneName of bones) {
      const bone = humanoid.getNormalizedBoneNode(boneName);
      if (bone) {
        bone.rotation.set(0, 0, 0);
      }
    }

    console.log("[Gesture] 제스처 컨트롤러 정리");
  }
}
