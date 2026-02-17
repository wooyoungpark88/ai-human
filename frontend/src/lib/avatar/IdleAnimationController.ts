import type { VRM } from "@pixiv/three-vrm";

/**
 * 아이들 애니메이션 컨트롤러
 * - 차분한 머리 미세 움직임 (상담사답게)
 * - 호흡 (척추 움직임)
 * - 경청 시 부드러운 고개끄덕임
 * - 자연스러운 팔 자세
 */
export class IdleAnimationController {
  private vrm: VRM;
  private isListening = false;
  private listenNodTimer = 0;
  private listenNodInterval = 2.5 + Math.random() * 2;
  private nodProgress = -1; // -1 = 비활성, 0~1 = 끄덕임 진행

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.initializeArmPose();
  }

  /**
   * 팔을 자연스럽게 내린 초기 포즈 설정
   */
  private initializeArmPose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    console.log("[IdleAnimation] 팔 포즈 초기화 시작");

    // 왼쪽 팔 - 완전히 내림
    const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");

    if (leftShoulder) {
      leftShoulder.rotation.z = 0.5; // 어깨를 많이 내림
      console.log("[IdleAnimation] leftShoulder 설정:", leftShoulder.rotation.z);
    }
    if (leftUpperArm) {
      leftUpperArm.rotation.z = 1.2; // 팔을 완전히 옆으로 내림 (약 69도)
      leftUpperArm.rotation.x = 0.4; // 팔을 약간 앞으로
      console.log("[IdleAnimation] leftUpperArm 설정:", leftUpperArm.rotation.z);
    }
    if (leftLowerArm) {
      leftLowerArm.rotation.z = -0.3; // 팔꿈치를 자연스럽게
    }

    // 오른쪽 팔 - 완전히 내림
    const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");

    if (rightShoulder) {
      rightShoulder.rotation.z = -0.5; // 어깨를 많이 내림
      console.log("[IdleAnimation] rightShoulder 설정:", rightShoulder.rotation.z);
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -1.2; // 팔을 완전히 옆으로 내림 (약 69도)
      rightUpperArm.rotation.x = 0.4; // 팔을 약간 앞으로
      console.log("[IdleAnimation] rightUpperArm 설정:", rightUpperArm.rotation.z);
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.z = 0.3; // 팔꿈치를 자연스럽게
    }

    console.log("[IdleAnimation] 팔 포즈 초기화 완료");
  }

  setListening(listening: boolean): void {
    this.isListening = listening;
    if (!listening) {
      this.nodProgress = -1;
    }
  }

  update(delta: number, elapsedTime: number): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const headBone = humanoid.getNormalizedBoneNode("head");
    if (headBone) {
      // 차분한 미세 움직임 (상담사답게 작은 진폭)
      let nodX = Math.sin(elapsedTime * 0.3) * 0.015;
      const turnY = Math.sin(elapsedTime * 0.2) * 0.02;
      const tiltZ = Math.sin(elapsedTime * 0.15) * 0.008;

      // 경청 고개끄덕임
      if (this.isListening) {
        this.listenNodTimer += delta;
        if (this.listenNodTimer >= this.listenNodInterval && this.nodProgress < 0) {
          this.listenNodTimer = 0;
          this.listenNodInterval = 2.5 + Math.random() * 2;
          this.nodProgress = 0;
        }
        if (this.nodProgress >= 0) {
          this.nodProgress += delta / 0.4; // 0.4초 동안 끄덕임
          if (this.nodProgress >= 1) {
            this.nodProgress = -1;
          } else {
            nodX += Math.sin(this.nodProgress * Math.PI) * 0.04;
          }
        }
      }

      headBone.rotation.x = nodX;
      headBone.rotation.y = turnY;
      headBone.rotation.z = tiltZ;
    }

    // 호흡 (척추)
    const spineBone = humanoid.getNormalizedBoneNode("spine");
    if (spineBone) {
      spineBone.rotation.x = Math.sin(elapsedTime * 0.8) * 0.005;
    }

    // 팔의 미세한 움직임 (호흡과 연동) - 매 프레임 강제 적용
    const breathIntensity = Math.sin(elapsedTime * 0.8) * 0.01;
    
    const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
    if (leftShoulder) {
      leftShoulder.rotation.z = 0.5;
    }
    
    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    if (leftUpperArm) {
      leftUpperArm.rotation.z = 1.2 + breathIntensity;
      leftUpperArm.rotation.x = 0.4;
    }

    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
    if (leftLowerArm) {
      leftLowerArm.rotation.z = -0.3;
    }

    const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
    if (rightShoulder) {
      rightShoulder.rotation.z = -0.5;
    }

    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    if (rightUpperArm) {
      rightUpperArm.rotation.z = -1.2 - breathIntensity;
      rightUpperArm.rotation.x = 0.4;
    }

    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
    if (rightLowerArm) {
      rightLowerArm.rotation.z = 0.3;
    }
  }

  dispose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;
    
    const headBone = humanoid.getNormalizedBoneNode("head");
    if (headBone) {
      headBone.rotation.set(0, 0, 0);
    }
    
    const spineBone = humanoid.getNormalizedBoneNode("spine");
    if (spineBone) {
      spineBone.rotation.set(0, 0, 0);
    }

    // 팔 초기화
    const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
    const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");

    if (leftShoulder) leftShoulder.rotation.set(0, 0, 0);
    if (leftUpperArm) leftUpperArm.rotation.set(0, 0, 0);
    if (leftLowerArm) leftLowerArm.rotation.set(0, 0, 0);
    if (rightShoulder) rightShoulder.rotation.set(0, 0, 0);
    if (rightUpperArm) rightUpperArm.rotation.set(0, 0, 0);
    if (rightLowerArm) rightLowerArm.rotation.set(0, 0, 0);
  }
}
