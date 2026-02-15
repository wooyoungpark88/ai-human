"use client";

import dynamic from "next/dynamic";
import type { VRM } from "@pixiv/three-vrm";
import type { VRMAvatarControllers } from "@/hooks/useVRMAvatar";

const VRMCanvas = dynamic(() => import("./VRMCanvas"), { ssr: false });

interface VRMSceneProps {
  vrm: VRM | null;
  controllers: VRMAvatarControllers;
  isLoading?: boolean;
}

export function VRMScene({ vrm, controllers, isLoading }: VRMSceneProps) {
  return <VRMCanvas vrm={vrm} controllers={controllers} isLoading={isLoading} />;
}
