import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import type { ConversationPhase, EmotionType } from "@/lib/types";

type MotionState = ConversationPhase;

type ArmBoneName =
  | "leftShoulder"
  | "leftUpperArm"
  | "leftLowerArm"
  | "rightShoulder"
  | "rightUpperArm"
  | "rightLowerArm";

interface BoneDelta {
  x: number;
  y: number;
  z: number;
}

type ArmPoseDelta = Record<ArmBoneName, BoneDelta>;

interface MotionDynamics {
  breathingAmp: number;
  fidgetAmp: number;
  transitionSpeed: number;
}

const ARM_BONES: ArmBoneName[] = [
  "leftShoulder",
  "leftUpperArm",
  "leftLowerArm",
  "rightShoulder",
  "rightUpperArm",
  "rightLowerArm",
];

function zeroBone(): BoneDelta {
  return { x: 0, y: 0, z: 0 };
}

function createPose(partial?: Partial<Record<ArmBoneName, Partial<BoneDelta>>>): ArmPoseDelta {
  const pose: ArmPoseDelta = {
    leftShoulder: zeroBone(),
    leftUpperArm: zeroBone(),
    leftLowerArm: zeroBone(),
    rightShoulder: zeroBone(),
    rightUpperArm: zeroBone(),
    rightLowerArm: zeroBone(),
  };

  if (!partial) return pose;

  for (const boneName of ARM_BONES) {
    const value = partial[boneName];
    if (!value) continue;
    pose[boneName] = {
      x: value.x ?? 0,
      y: value.y ?? 0,
      z: value.z ?? 0,
    };
  }

  return pose;
}

function addPose(a: ArmPoseDelta, b: ArmPoseDelta): ArmPoseDelta {
  const out = createPose();
  for (const boneName of ARM_BONES) {
    out[boneName].x = a[boneName].x + b[boneName].x;
    out[boneName].y = a[boneName].y + b[boneName].y;
    out[boneName].z = a[boneName].z + b[boneName].z;
  }
  return out;
}

function scalePose(source: ArmPoseDelta, scale: number): ArmPoseDelta {
  const out = createPose();
  for (const boneName of ARM_BONES) {
    out[boneName].x = source[boneName].x * scale;
    out[boneName].y = source[boneName].y * scale;
    out[boneName].z = source[boneName].z * scale;
  }
  return out;
}

const PHASE_BASE_POSES: Record<MotionState, ArmPoseDelta> = {
  idle: createPose(),
  listening: createPose({
    leftShoulder: { z: 0.03 },
    leftUpperArm: { x: 0.06, z: 0.06 },
    leftLowerArm: { x: 0.04, z: -0.04 },
    rightShoulder: { z: -0.03 },
    rightUpperArm: { x: 0.06, z: -0.06 },
    rightLowerArm: { x: 0.04, z: 0.04 },
  }),
  thinking: createPose({
    leftUpperArm: { x: 0.06, z: 0.03 },
    leftLowerArm: { x: 0.05, z: -0.04 },
    rightShoulder: { z: -0.06 },
    rightUpperArm: { x: 0.28, z: -0.18 },
    rightLowerArm: { x: 0.36, z: 0.32 },
  }),
  speaking: createPose({
    leftShoulder: { z: 0.05 },
    leftUpperArm: { x: 0.16, z: 0.24 },
    leftLowerArm: { x: 0.1, z: -0.16 },
    rightShoulder: { z: -0.05 },
    rightUpperArm: { x: 0.16, z: -0.24 },
    rightLowerArm: { x: 0.1, z: 0.16 },
  }),
};

const EMOTION_OVERLAYS: Record<EmotionType, ArmPoseDelta> = {
  neutral: createPose(),
  happy: createPose({
    leftShoulder: { z: 0.02 },
    leftUpperArm: { x: 0.08, z: 0.16 },
    leftLowerArm: { x: 0.04, z: -0.08 },
    rightShoulder: { z: -0.02 },
    rightUpperArm: { x: 0.08, z: -0.16 },
    rightLowerArm: { x: 0.04, z: 0.08 },
  }),
  sad: createPose({
    leftShoulder: { z: -0.07 },
    leftUpperArm: { x: -0.08, z: -0.1 },
    leftLowerArm: { x: -0.06, z: 0.06 },
    rightShoulder: { z: 0.07 },
    rightUpperArm: { x: -0.08, z: 0.1 },
    rightLowerArm: { x: -0.06, z: -0.06 },
  }),
  angry: createPose({
    leftShoulder: { z: 0.07 },
    leftUpperArm: { x: 0.2, z: 0.32 },
    leftLowerArm: { x: 0.24, z: -0.28 },
    rightShoulder: { z: -0.07 },
    rightUpperArm: { x: 0.2, z: -0.32 },
    rightLowerArm: { x: 0.24, z: 0.28 },
  }),
  surprised: createPose({
    leftShoulder: { z: 0.1 },
    leftUpperArm: { x: 0.2, z: 0.46 },
    leftLowerArm: { x: 0.14, z: -0.12 },
    rightShoulder: { z: -0.1 },
    rightUpperArm: { x: 0.2, z: -0.46 },
    rightLowerArm: { x: 0.14, z: 0.12 },
  }),
  thinking: createPose({
    leftUpperArm: { x: 0.04, z: 0.06 },
    leftLowerArm: { x: 0.06, z: -0.04 },
    rightShoulder: { z: -0.04 },
    rightUpperArm: { x: 0.2, z: -0.12 },
    rightLowerArm: { x: 0.22, z: 0.16 },
  }),
  anxious: createPose({
    leftShoulder: { z: 0.03 },
    leftUpperArm: { x: 0.24, z: 0.1 },
    leftLowerArm: { x: 0.18, z: -0.2 },
    rightShoulder: { z: -0.03 },
    rightUpperArm: { x: 0.24, z: -0.1 },
    rightLowerArm: { x: 0.18, z: 0.2 },
  }),
  empathetic: createPose({
    leftShoulder: { z: 0.02 },
    leftUpperArm: { x: 0.14, z: 0.18 },
    leftLowerArm: { x: 0.1, z: -0.08 },
    rightShoulder: { z: -0.02 },
    rightUpperArm: { x: 0.14, z: -0.18 },
    rightLowerArm: { x: 0.1, z: 0.08 },
  }),
};

const MOTION_DYNAMICS: Record<MotionState, MotionDynamics> = {
  idle: { breathingAmp: 0.012, fidgetAmp: 0.018, transitionSpeed: 5.5 },
  listening: { breathingAmp: 0.016, fidgetAmp: 0.022, transitionSpeed: 6.5 },
  thinking: { breathingAmp: 0.01, fidgetAmp: 0.014, transitionSpeed: 4.4 },
  speaking: { breathingAmp: 0.02, fidgetAmp: 0.03, transitionSpeed: 8.5 },
};

const DEV = process.env.NODE_ENV !== "production";

/**
 * 제스처 컨트롤러
 * - 감정 + 모션 상태(대기/경청/생각/발화) 기반 상지 포즈 제어
 * - baseline quaternion 대비 delta를 적용하여 모델별 기본 자세 보존
 * - quaternion slerp로 부드러운 전환
 */
export class GestureController {
  private vrm: VRM;
  private baselinePose: Partial<Record<ArmBoneName, THREE.Quaternion>> = {};
  private restPose = createPose();
  private currentPose = createPose();
  private targetPose = createPose();
  private conversationPhase: MotionState = "idle";
  private emotion: EmotionType = "neutral";
  private intensity = 0.5;
  private lipSyncActive = false;
  private fidgetPhase = Math.random() * Math.PI * 2;
  private baselineCaptured = false;
  private loggedOnce = false;

  // 재사용 헬퍼 (GC 회피)
  private _euler = new THREE.Euler();
  private _deltaQuat = new THREE.Quaternion();
  private _targetQuat = new THREE.Quaternion();

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.captureBaselinePose();
    console.log("[Gesture] 제스처 컨트롤러 초기화");
  }

  setEmotion(emotion: EmotionType, intensity: number): void {
    this.emotion = emotion;
    this.intensity = Math.min(1, Math.max(0, intensity));
  }

  setConversationPhase(phase: MotionState): void {
    this.conversationPhase = phase;
  }

  setLipSyncActive(active: boolean): void {
    this.lipSyncActive = active;
  }

  private resolveMotionState(): MotionState {
    if (this.lipSyncActive) return "speaking";
    return this.conversationPhase;
  }

  private captureBaselinePose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    let foundCount = 0;
    for (const boneName of ARM_BONES) {
      const bone = humanoid.getNormalizedBoneNode(boneName as VRMHumanBoneName);
      if (!bone) continue;
      this.baselinePose[boneName] = bone.quaternion.clone();
      foundCount++;
    }

    this.baselineCaptured = foundCount > 0;
    this.computeRestPose();
    if (DEV) {
      console.log(`[Gesture] baseline capture: ${foundCount}/${ARM_BONES.length}`);
    }
  }

  private getBoneSign(boneName: ArmBoneName, fallback: 1 | -1): 1 | -1 {
    const baseline = this.baselinePose[boneName];
    if (!baseline) return fallback;
    if (Math.abs(baseline.z) < 0.01) return fallback;
    return baseline.z >= 0 ? 1 : -1;
  }

  private resolveArmDownSign(
    upperBone: "leftUpperArm" | "rightUpperArm",
    lowerBone: "leftLowerArm" | "rightLowerArm",
    fallback: 1 | -1,
  ): 1 | -1 {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return fallback;

    const baseline = this.baselinePose[upperBone];
    const lower = humanoid.getNormalizedBoneNode(lowerBone as VRMHumanBoneName);
    if (!baseline || !lower) return fallback;

    const lowerOffset = lower.position.clone();
    if (lowerOffset.lengthSq() < 1e-6) return fallback;

    let bestSign: 1 | -1 = fallback;
    let bestY = Number.POSITIVE_INFINITY;
    const zMagnitude = 1.0;
    const xTilt = 0.16;

    for (const sign of [-1, 1] as const) {
      this._euler.set(xTilt, 0, sign * zMagnitude, "XYZ");
      this._deltaQuat.setFromEuler(this._euler);
      this._targetQuat.copy(baseline).multiply(this._deltaQuat);

      const dir = lowerOffset.clone().applyQuaternion(this._targetQuat);
      if (dir.y < bestY) {
        bestY = dir.y;
        bestSign = sign;
      }
    }

    if (DEV) {
      console.log(`[Gesture] ${upperBone} down-sign=${bestSign} (bestY=${bestY.toFixed(4)})`);
    }
    return bestSign;
  }

  /**
   * baseline이 T-pose일 수 있으므로 idle에서도 팔이 내려오도록
   * 모델 기준 오프셋을 한 번 계산해 둔다.
   */
  private computeRestPose(): void {
    const leftSign = this.resolveArmDownSign("leftUpperArm", "leftLowerArm", -this.getBoneSign("leftUpperArm", 1) as 1 | -1);
    const rightSign = this.resolveArmDownSign("rightUpperArm", "rightLowerArm", -this.getBoneSign("rightUpperArm", -1) as 1 | -1);

    this.restPose = createPose({
      leftShoulder: { z: 0.1 * leftSign },
      leftUpperArm: { x: 0.16, z: 1.15 * leftSign },
      leftLowerArm: { x: 0.08, z: -0.3 * leftSign },
      rightShoulder: { z: 0.1 * rightSign },
      rightUpperArm: { x: 0.16, z: 1.15 * rightSign },
      rightLowerArm: { x: 0.08, z: -0.3 * rightSign },
    });
  }

  private getDynamicPose(state: MotionState, elapsedTime: number): ArmPoseDelta {
    const dynamic = createPose();
    const profile = MOTION_DYNAMICS[state];
    const breathing = Math.sin(elapsedTime * 1.2) * profile.breathingAmp;
    const fidgetL =
      Math.sin(this.fidgetPhase * 0.8 + 0.7) * profile.fidgetAmp +
      Math.sin(this.fidgetPhase * 1.7 + 2.1) * (profile.fidgetAmp * 0.5);
    const fidgetR =
      Math.sin(this.fidgetPhase * 0.78 + 2.6) * profile.fidgetAmp +
      Math.sin(this.fidgetPhase * 1.6 + 1.1) * (profile.fidgetAmp * 0.5);

    dynamic.leftUpperArm.z = breathing + fidgetL;
    dynamic.leftLowerArm.z = fidgetL * 0.85;
    dynamic.rightUpperArm.z = -breathing + fidgetR;
    dynamic.rightLowerArm.z = fidgetR * 0.85;

    if (state === "speaking") {
      const talkPulse = Math.sin(elapsedTime * 6.5) * 0.045;
      dynamic.leftUpperArm.x += Math.max(0, talkPulse);
      dynamic.rightUpperArm.x += Math.max(0, -talkPulse);
    }

    return dynamic;
  }

  private applyBonePose(boneName: ArmBoneName, pose: BoneDelta, slerpFactor: number): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const bone = humanoid.getNormalizedBoneNode(boneName as VRMHumanBoneName);
    const baseline = this.baselinePose[boneName];
    if (!bone || !baseline) return;

    this._euler.set(pose.x, pose.y, pose.z, "XYZ");
    this._deltaQuat.setFromEuler(this._euler);
    this._targetQuat.copy(baseline).multiply(this._deltaQuat);
    bone.quaternion.slerp(this._targetQuat, slerpFactor);
  }

  update(delta: number, elapsedTime: number): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    if (!this.baselineCaptured) {
      this.captureBaselinePose();
      if (!this.baselineCaptured) return;
    }

    const motionState = this.resolveMotionState();
    const phasePose = addPose(this.restPose, PHASE_BASE_POSES[motionState]);
    const emotionPose = EMOTION_OVERLAYS[this.emotion] || EMOTION_OVERLAYS.neutral;
    const emotionBlend = this.intensity;
    const blendedEmotion = scalePose(emotionPose, emotionBlend);
    this.targetPose = addPose(phasePose, blendedEmotion);

    const dynamics = MOTION_DYNAMICS[motionState];
    const smoothFactor = 1.0 - Math.exp(-dynamics.transitionSpeed * delta);
    const slerpFactor = 1.0 - Math.exp(-12.0 * delta);

    for (const boneName of ARM_BONES) {
      this.currentPose[boneName].x +=
        (this.targetPose[boneName].x - this.currentPose[boneName].x) * smoothFactor;
      this.currentPose[boneName].y +=
        (this.targetPose[boneName].y - this.currentPose[boneName].y) * smoothFactor;
      this.currentPose[boneName].z +=
        (this.targetPose[boneName].z - this.currentPose[boneName].z) * smoothFactor;
    }

    this.fidgetPhase += delta;
    const dynamicPose = this.getDynamicPose(motionState, elapsedTime);
    const finalPose = addPose(this.currentPose, dynamicPose);

    for (const boneName of ARM_BONES) {
      this.applyBonePose(boneName, finalPose[boneName], slerpFactor);
    }

    if (DEV && !this.loggedOnce) {
      this.loggedOnce = true;
      const left = humanoid.getNormalizedBoneNode("leftUpperArm");
      const right = humanoid.getNormalizedBoneNode("rightUpperArm");
      console.log(
        "[Gesture] runtime check",
        `state=${motionState}`,
        `emotion=${this.emotion}`,
        `leftUpperArm=${left ? "OK" : "NULL"}`,
        `rightUpperArm=${right ? "OK" : "NULL"}`
      );
    }
  }

  dispose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    for (const boneName of ARM_BONES) {
      const bone = humanoid.getNormalizedBoneNode(boneName as VRMHumanBoneName);
      const baseline = this.baselinePose[boneName];
      if (bone && baseline) {
        bone.quaternion.copy(baseline);
      }
    }

    this.currentPose = createPose();
    this.targetPose = createPose();
    this.conversationPhase = "idle";
    this.emotion = "neutral";
    this.intensity = 0.5;
    this.lipSyncActive = false;

    console.log("[Gesture] 제스처 컨트롤러 정리");
  }
}
