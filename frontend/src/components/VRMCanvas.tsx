"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { VRM } from "@pixiv/three-vrm";
import type { VRMAvatarControllers } from "@/hooks/useVRMAvatar";

interface VRMCharacterProps {
  vrm: VRM;
  controllers: VRMAvatarControllers;
}

function VRMCharacter({ vrm, controllers }: VRMCharacterProps) {
  const { scene, camera } = useThree();
  const addedRef = useRef(false);
  const diagCountRef = useRef(0);

  useEffect(() => {
    // 가슴 중앙을 바라보도록 설정 (머리가 잘리지 않도록)
    camera.lookAt(0, 1.2, 0);
  }, [camera]);

  useEffect(() => {
    if (vrm.scene && !addedRef.current) {
      scene.add(vrm.scene);
      addedRef.current = true;
    }
    return () => {
      if (addedRef.current && vrm.scene) {
        scene.remove(vrm.scene);
        addedRef.current = false;
      }
    };
  }, [vrm, scene]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const humanoid = vrm.humanoid;
    const diag = diagCountRef.current < 3;
    if (diag) diagCountRef.current++;

    // 1. 모든 컨트롤러가 normalized bone/expression 설정
    controllers.idle?.update(delta, elapsed);
    controllers.gesture?.update(delta, elapsed);
    controllers.blink?.update(delta, elapsed);
    controllers.expression?.updateIdle(delta, elapsed);
    controllers.expression?.update(delta);
    controllers.lipSync?.update(delta);

    // --- 진단: 컨트롤러 설정 후 normalized bone quaternion 확인 ---
    if (diag && humanoid) {
      const normL = humanoid.getNormalizedBoneNode("leftUpperArm");
      const rawL = humanoid.getRawBoneNode("leftUpperArm");
      if (normL) {
        console.log(`[DIAG frame${diagCountRef.current}] AFTER controllers:`,
          `normL.q=[${normL.quaternion.toArray().map((v: number) => v.toFixed(4)).join(",")}]`,
          `rawL.q=[${rawL?.quaternion.toArray().map((v: number) => v.toFixed(4)).join(",") ?? "NULL"}]`);
      }
    }

    // 2. vrm.update() — normalized→raw bone 변환 + 스프링본 + expression 적용
    vrm.update(delta);

    // --- 진단: vrm.update() 후 raw bone quaternion 확인 ---
    if (diag && humanoid) {
      const rawL = humanoid.getRawBoneNode("leftUpperArm");
      const rawR = humanoid.getRawBoneNode("rightUpperArm");
      if (rawL) {
        console.log(`[DIAG frame${diagCountRef.current}] AFTER vrm.update():`,
          `rawL.q=[${rawL.quaternion.toArray().map((v: number) => v.toFixed(4)).join(",")}]`,
          `rawR.q=[${rawR?.quaternion.toArray().map((v: number) => v.toFixed(4)).join(",") ?? "NULL"}]`);
      }
    }

    // 3. 스프링본이 팔 rotation을 덮어쓸 수 있으므로,
    //    vrm.update() 이후 humanoid.update()를 다시 호출하여
    //    normalized→raw 변환을 재적용
    if (humanoid) {
      humanoid.update();

      // --- 진단: humanoid.update() 재적용 후 확인 ---
      if (diag) {
        const rawL = humanoid.getRawBoneNode("leftUpperArm");
        if (rawL) {
          console.log(`[DIAG frame${diagCountRef.current}] AFTER 2nd humanoid.update():`,
            `rawL.q=[${rawL.quaternion.toArray().map((v: number) => v.toFixed(4)).join(",")}]`);
        }
      }
    }
  });

  return null;
}

interface VRMCanvasProps {
  vrm: VRM | null;
  controllers: VRMAvatarControllers;
  isLoading?: boolean;
}

export default function VRMCanvas({ vrm, controllers }: VRMCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.3, 0.9], fov: 35, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[1, 2, 1]} intensity={0.8} />
      <directionalLight position={[-1, 1, -1]} intensity={0.3} />

      {vrm && <VRMCharacter vrm={vrm} controllers={controllers} />}
    </Canvas>
  );
}
