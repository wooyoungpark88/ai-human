import type { VRM } from "@pixiv/three-vrm";

/**
 * 아이들 애니메이션 컨트롤러
 * - 미세한 머리 움직임 (고개 끄덕/돌림)
 * - 미세한 호흡 (가슴/척추 움직임)
 */
export class IdleAnimationController {
  private vrm: VRM;

  constructor(vrm: VRM) {
    this.vrm = vrm;
  }

  update(_delta: number, elapsedTime: number): void {
    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    // 머리 미세 움직임 (서로 다른 주파수로 자연스러움)
    const headBone = humanoid.getNormalizedBoneNode("head");
    if (headBone) {
      headBone.rotation.x = Math.sin(elapsedTime * 0.3) * 0.02;
      headBone.rotation.y = Math.sin(elapsedTime * 0.2) * 0.03;
      headBone.rotation.z = Math.sin(elapsedTime * 0.15) * 0.01;
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
