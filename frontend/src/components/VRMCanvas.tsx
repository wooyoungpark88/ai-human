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
  const { scene } = useThree();
  const addedRef = useRef(false);

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

    // 컨트롤러가 먼저 setValue() 호출
    controllers.blink?.update(delta, elapsed);
    controllers.idle?.update(delta, elapsed);
    controllers.expression?.update(delta);
    controllers.lipSync?.update(delta);

    // vrm.update()가 마지막에 호출되어야 현재 프레임의 expression 값이 즉시 적용됨
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
      camera={{ position: [0, 1.35, 0.8], fov: 35, near: 0.1, far: 100 }}
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
