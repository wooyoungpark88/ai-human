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
  const loggedRef = useRef(false);

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
    if (!loggedRef.current) {
      loggedRef.current = true;
      console.log("[VRM] Runtime — scene.rotation.y:", vrm.scene.rotation.y.toFixed(2),
        "| meta:", vrm.meta?.metaVersion);
    }
    const elapsed = state.clock.elapsedTime;

    // 1. 모든 컨트롤러가 normalized bone/expression 설정
    controllers.idle?.update(delta, elapsed);
    controllers.gesture?.update(delta, elapsed);
    controllers.blink?.update(delta, elapsed);
    controllers.expression?.updateIdle(delta, elapsed);
    controllers.expression?.update(delta);
    controllers.lipSync?.update(delta);

    // 2. vrm.update() — normalized→raw bone 변환 + 스프링본 + expression 적용
    vrm.update(delta);
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
