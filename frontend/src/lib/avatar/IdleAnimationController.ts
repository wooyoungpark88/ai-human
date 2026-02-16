import type { VRM } from "@pixiv/three-vrm";

/**
 * 아이들 애니메이션 컨트롤러
 * - 차분한 머리 미세 움직임 (상담사답게)
 * - 호흡 (척추 움직임)
 * - 경청 시 부드러운 고개끄덕임
 */
export class IdleAnimationController {
  private vrm: VRM;
  private isListening = false;
  private listenNodTimer = 0;
  private listenNodInterval = 2.5 + Math.random() * 2;
  private nodProgress = -1; // -1 = 비활성, 0~1 = 끄덕임 진행

  constructor(vrm: VRM) {
    this.vrm = vrm;
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
  }
}
