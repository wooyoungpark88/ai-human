import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType } from "@/lib/types";

/**
 * 팔/어깨 제스처 정의 (라디안)
 */
interface ArmPose {
  leftShoulder: { z: number };
  leftUpperArm: { z: number; x: number };
  leftLowerArm: { z: number };
  rightShoulder: { z: number };
  rightUpperArm: { z: number; x: number };
  rightLowerArm: { z: number };
}

/**
 * 감정별 제스처 매핑
 */
const EMOTION_GESTURES: Record<EmotionType, ArmPose> = {
  neutral: {
    leftShoulder: { z: 0.4 },
    leftUpperArm: { z: 1.0, x: 0.3 },
    leftLowerArm: { z: -0.2 },
    rightShoulder: { z: -0.4 },
    rightUpperArm: { z: -1.0, x: 0.3 },
    rightLowerArm: { z: 0.2 },
  },
  happy: {
    leftShoulder: { z: 0.3 },
    leftUpperArm: { z: 0.8, x: 0.2 },
    leftLowerArm: { z: -0.15 },
    rightShoulder: { z: -0.3 },
    rightUpperArm: { z: -0.8, x: 0.2 },
    rightLowerArm: { z: 0.15 },
  },
  sad: {
    leftShoulder: { z: 0.6 },
    leftUpperArm: { z: 1.3, x: 0.4 },
    leftLowerArm: { z: -0.25 },
    rightShoulder: { z: -0.6 },
    rightUpperArm: { z: -1.3, x: 0.4 },
    rightLowerArm: { z: 0.25 },
  },
  angry: {
    leftShoulder: { z: 0.2 },
    leftUpperArm: { z: 0.9, x: 0.1 },
    leftLowerArm: { z: -0.3 },
    rightShoulder: { z: -0.2 },
    rightUpperArm: { z: -0.9, x: 0.1 },
    rightLowerArm: { z: 0.3 },
  },
  surprised: {
    leftShoulder: { z: 0.1 },
    leftUpperArm: { z: 0.6, x: 0.1 },
    leftLowerArm: { z: -0.1 },
    rightShoulder: { z: -0.1 },
    rightUpperArm: { z: -0.6, x: 0.1 },
    rightLowerArm: { z: 0.1 },
  },
  thinking: {
    leftShoulder: { z: 0.5 },
    leftUpperArm: { z: 1.1, x: 0.35 },
    leftLowerArm: { z: -0.2 },
    rightShoulder: { z: -0.5 },
    rightUpperArm: { z: -1.1, x: 0.35 },
    rightLowerArm: { z: 0.2 },
  },
  anxious: {
    leftShoulder: { z: 0.5 },
    leftUpperArm: { z: 1.15, x: 0.5 },
    leftLowerArm: { z: -0.3 },
    rightShoulder: { z: -0.5 },
    rightUpperArm: { z: -1.15, x: 0.5 },
    rightLowerArm: { z: 0.3 },
  },
  empathetic: {
    leftShoulder: { z: 0.35 },
    leftUpperArm: { z: 0.9, x: 0.25 },
    leftLowerArm: { z: -0.15 },
    rightShoulder: { z: -0.35 },
    rightUpperArm: { z: -0.9, x: 0.25 },
    rightLowerArm: { z: 0.15 },
  },
};

/**
 * 제스처 컨트롤러
 * - 감정에 따른 팔/어깨 포즈 변화
 * - 부드러운 전환 애니메이션
 */
export class GestureController {
  private vrm: VRM;
  private currentPose: ArmPose;
  private targetPose: ArmPose;
  private transitionSpeed = 2.0; // 포즈 전환 속도

  constructor(vrm: VRM) {
    this.vrm = vrm;
    // 초기 포즈: neutral
    this.currentPose = JSON.parse(JSON.stringify(EMOTION_GESTURES.neutral));
    this.targetPose = JSON.parse(JSON.stringify(EMOTION_GESTURES.neutral));
    
    console.log("[Gesture] 제스처 컨트롤러 초기화");
  }

  /**
   * 감정에 따른 제스처 설정
   */
  setEmotion(emotion: EmotionType, intensity: number): void {
    const gesture = EMOTION_GESTURES[emotion] || EMOTION_GESTURES.neutral;
    
    // intensity에 따라 neutral과 블렌딩
    const neutralGesture = EMOTION_GESTURES.neutral;
    const blend = 0.3 + intensity * 0.7; // 30%~100% 블렌딩
    
    this.targetPose = {
      leftShoulder: {
        z: neutralGesture.leftShoulder.z * (1 - blend) + gesture.leftShoulder.z * blend,
      },
      leftUpperArm: {
        z: neutralGesture.leftUpperArm.z * (1 - blend) + gesture.leftUpperArm.z * blend,
        x: neutralGesture.leftUpperArm.x * (1 - blend) + gesture.leftUpperArm.x * blend,
      },
      leftLowerArm: {
        z: neutralGesture.leftLowerArm.z * (1 - blend) + gesture.leftLowerArm.z * blend,
      },
      rightShoulder: {
        z: neutralGesture.rightShoulder.z * (1 - blend) + gesture.rightShoulder.z * blend,
      },
      rightUpperArm: {
        z: neutralGesture.rightUpperArm.z * (1 - blend) + gesture.rightUpperArm.z * blend,
        x: neutralGesture.rightUpperArm.x * (1 - blend) + gesture.rightUpperArm.x * blend,
      },
      rightLowerArm: {
        z: neutralGesture.rightLowerArm.z * (1 - blend) + gesture.rightLowerArm.z * blend,
      },
    };

    console.log(`[Gesture] 감정 설정: ${emotion}, intensity: ${intensity.toFixed(2)}`);
  }

  /**
   * 매 프레임 업데이트 (부드러운 전환)
   */
  update(delta: number, elapsedTime: number): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    // 호흡 효과
    const breathIntensity = Math.sin(elapsedTime * 0.8) * 0.015;

    // 부드러운 전환 (지수 스무딩)
    const smoothFactor = 1.0 - Math.exp(-this.transitionSpeed * delta);

    // 왼쪽 어깨
    const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
    if (leftShoulder) {
      this.currentPose.leftShoulder.z += 
        (this.targetPose.leftShoulder.z - this.currentPose.leftShoulder.z) * smoothFactor;
      leftShoulder.rotation.z = this.currentPose.leftShoulder.z;
    }

    // 왼쪽 팔
    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    if (leftUpperArm) {
      this.currentPose.leftUpperArm.z += 
        (this.targetPose.leftUpperArm.z - this.currentPose.leftUpperArm.z) * smoothFactor;
      this.currentPose.leftUpperArm.x += 
        (this.targetPose.leftUpperArm.x - this.currentPose.leftUpperArm.x) * smoothFactor;
      
      leftUpperArm.rotation.z = this.currentPose.leftUpperArm.z + breathIntensity;
      leftUpperArm.rotation.x = this.currentPose.leftUpperArm.x;
    }

    // 왼쪽 팔꿈치
    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
    if (leftLowerArm) {
      this.currentPose.leftLowerArm.z += 
        (this.targetPose.leftLowerArm.z - this.currentPose.leftLowerArm.z) * smoothFactor;
      leftLowerArm.rotation.z = this.currentPose.leftLowerArm.z;
    }

    // 오른쪽 어깨
    const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
    if (rightShoulder) {
      this.currentPose.rightShoulder.z += 
        (this.targetPose.rightShoulder.z - this.currentPose.rightShoulder.z) * smoothFactor;
      rightShoulder.rotation.z = this.currentPose.rightShoulder.z;
    }

    // 오른쪽 팔
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    if (rightUpperArm) {
      this.currentPose.rightUpperArm.z += 
        (this.targetPose.rightUpperArm.z - this.currentPose.rightUpperArm.z) * smoothFactor;
      this.currentPose.rightUpperArm.x += 
        (this.targetPose.rightUpperArm.x - this.currentPose.rightUpperArm.x) * smoothFactor;
      
      rightUpperArm.rotation.z = this.currentPose.rightUpperArm.z - breathIntensity;
      rightUpperArm.rotation.x = this.currentPose.rightUpperArm.x;
    }

    // 오른쪽 팔꿈치
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
    if (rightLowerArm) {
      this.currentPose.rightLowerArm.z += 
        (this.targetPose.rightLowerArm.z - this.currentPose.rightLowerArm.z) * smoothFactor;
      rightLowerArm.rotation.z = this.currentPose.rightLowerArm.z;
    }
  }

  /**
   * 정리
   */
  dispose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const bones = [
      "leftShoulder", "leftUpperArm", "leftLowerArm",
      "rightShoulder", "rightUpperArm", "rightLowerArm"
    ];

    for (const boneName of bones) {
      const bone = humanoid.getNormalizedBoneNode(boneName as any);
      if (bone) {
        bone.rotation.set(0, 0, 0);
      }
    }

    console.log("[Gesture] 제스처 컨트롤러 정리");
  }
}
