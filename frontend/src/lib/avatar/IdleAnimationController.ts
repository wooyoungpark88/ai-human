import type { VRM } from "@pixiv/three-vrm";

/**
 * 아이들 애니메이션 컨트롤러
 * - 자연스러운 머리 움직임 (다중 사인파 합성)
 * - 호흡 (척추 + 어깨 미세 움직임)
 * - 체중 이동 (상체 미세 좌우)
 * - 경청 시 고개끄덕임
 * - 간헐적 큰 동작 (자세 바꾸기)
 */
export class IdleAnimationController {
  private vrm: VRM;
  private isListening = false;
  private listenNodTimer = 0;
  private listenNodInterval = 2.5 + Math.random() * 2;
  private nodProgress = -1;

  // 간헐적 큰 동작
  private shiftTimer = 0;
  private shiftInterval = 8 + Math.random() * 7; // 8~15초마다
  private shiftTarget = 0;
  private shiftCurrent = 0;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    console.log("[IdleAnimation] 아이들 애니메이션 컨트롤러 초기화");
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

    // --- 머리 움직임 (다중 주파수 합성 → 자연스러운 불규칙 움직임) ---
    const headBone = humanoid.getNormalizedBoneNode("head");
    if (headBone) {
      // 기본 끄덕임 (상하)
      let nodX =
        Math.sin(elapsedTime * 0.3) * 0.025 +
        Math.sin(elapsedTime * 0.7 + 1.3) * 0.015 +
        Math.sin(elapsedTime * 0.13 + 2.7) * 0.01;

      // 좌우 돌림
      const turnY =
        Math.sin(elapsedTime * 0.2) * 0.035 +
        Math.sin(elapsedTime * 0.5 + 0.8) * 0.015;

      // 갸우뚱
      const tiltZ =
        Math.sin(elapsedTime * 0.15) * 0.02 +
        Math.sin(elapsedTime * 0.4 + 1.5) * 0.008;

      // 경청 고개끄덕임
      if (this.isListening) {
        this.listenNodTimer += delta;
        if (
          this.listenNodTimer >= this.listenNodInterval &&
          this.nodProgress < 0
        ) {
          this.listenNodTimer = 0;
          this.listenNodInterval = 2.0 + Math.random() * 2;
          this.nodProgress = 0;
        }
        if (this.nodProgress >= 0) {
          this.nodProgress += delta / 0.35;
          if (this.nodProgress >= 1) {
            this.nodProgress = -1;
          } else {
            nodX += Math.sin(this.nodProgress * Math.PI) * 0.06;
          }
        }
      }

      headBone.rotation.x = nodX;
      headBone.rotation.y = turnY;
      headBone.rotation.z = tiltZ;
    }

    // --- 호흡 (척추 + 가슴) ---
    const breathCycle = Math.sin(elapsedTime * 0.8);
    const breathCycle2 = Math.sin(elapsedTime * 0.8 + 0.3); // 약간 지연된 2차

    const spineBone = humanoid.getNormalizedBoneNode("spine");
    if (spineBone) {
      spineBone.rotation.x = breathCycle * 0.012;
    }

    const chestBone = humanoid.getNormalizedBoneNode("chest");
    if (chestBone) {
      chestBone.rotation.x = breathCycle2 * 0.008;
    }

    // --- 체중 이동 (상체 좌우 미세 흔들림 + 간헐적 큰 이동) ---
    this.shiftTimer += delta;
    if (this.shiftTimer >= this.shiftInterval) {
      this.shiftTimer = 0;
      this.shiftInterval = 8 + Math.random() * 7;
      // 새 체중 이동 목표 (-1, 0, 1 중 랜덤)
      this.shiftTarget = (Math.floor(Math.random() * 3) - 1) * 0.015;
    }
    // 부드러운 전환
    this.shiftCurrent += (this.shiftTarget - this.shiftCurrent) * delta * 0.8;

    const hipsBone = humanoid.getNormalizedBoneNode("hips");
    if (hipsBone) {
      const sway = Math.sin(elapsedTime * 0.12) * 0.008 + this.shiftCurrent;
      hipsBone.rotation.z = sway;
      // 호흡에 따른 미세 상하
      hipsBone.position.y = (hipsBone.position.y || 0) + breathCycle * 0.0005;
    }

    // --- 어깨 미세 움직임 (호흡 연동) ---
    const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
    if (leftShoulder) {
      leftShoulder.rotation.z += breathCycle * 0.005;
    }
    const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
    if (rightShoulder) {
      rightShoulder.rotation.z -= breathCycle * 0.005;
    }
  }

  dispose(): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const bonesToReset = ["head", "spine", "chest", "hips"];
    for (const boneName of bonesToReset) {
      const bone = humanoid.getNormalizedBoneNode(boneName as "head");
      if (bone) {
        bone.rotation.set(0, 0, 0);
      }
    }

    console.log("[IdleAnimation] 아이들 애니메이션 정리");
  }
}
