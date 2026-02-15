"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VRM } from "@pixiv/three-vrm";
import type { EmotionType } from "@/lib/types";
import { VRM_MODEL_PATH } from "@/lib/constants";
import { AudioStreamPlayer } from "@/lib/audio/AudioStreamPlayer";
import { ExpressionController } from "@/lib/avatar/ExpressionController";
import { LipSyncController } from "@/lib/avatar/LipSyncController";
import { BlinkController } from "@/lib/avatar/BlinkController";
import { IdleAnimationController } from "@/lib/avatar/IdleAnimationController";

export interface VRMAvatarControllers {
  expression: ExpressionController | null;
  lipSync: LipSyncController | null;
  blink: BlinkController | null;
  idle: IdleAnimationController | null;
}

const EMPTY_CONTROLLERS: VRMAvatarControllers = {
  expression: null,
  lipSync: null,
  blink: null,
  idle: null,
};

export function useVRMAvatar() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // controllers를 state로 관리하여 React 리렌더 보장
  const [controllers, setControllers] = useState<VRMAvatarControllers>(EMPTY_CONTROLLERS);

  const vrmRef = useRef<VRM | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
  // 내부 ref도 유지 (setEmotion 등에서 최신 값 접근용)
  const controllersRef = useRef<VRMAvatarControllers>(EMPTY_CONTROLLERS);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Three.js 모듈을 동적으로 임포트 (SSR 방지)
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      const gltf = await new Promise<{ userData: { vrm: VRM } }>((resolve, reject) => {
        loader.load(
          VRM_MODEL_PATH,
          (result) => resolve(result as unknown as { userData: { vrm: VRM } }),
          undefined,
          (err) => reject(err)
        );
      });

      const vrm = gltf.userData.vrm;
      VRMUtils.rotateVRM0(vrm);
      vrmRef.current = vrm;

      // 오디오 플레이어 초기화
      const audioPlayer = new AudioStreamPlayer();
      await audioPlayer.init();
      audioPlayerRef.current = audioPlayer;

      // 컨트롤러 초기화
      const analyser = audioPlayer.getAnalyser();
      const newControllers: VRMAvatarControllers = {
        expression: new ExpressionController(vrm),
        lipSync: analyser ? new LipSyncController(vrm, analyser) : null,
        blink: new BlinkController(vrm),
        idle: new IdleAnimationController(vrm),
      };
      controllersRef.current = newControllers;
      setControllers(newControllers); // React 리렌더 트리거

      // 사용 가능한 표정 로깅
      if (vrm.expressionManager) {
        const names = vrm.expressionManager.expressions.map(
          (e) => e.expressionName
        );
        console.log("[VRM] 사용 가능한 표정:", names.join(", "));
      }

      setIsInitialized(true);
      setIsLoading(false);
      console.log("[VRM] 초기화 완료");
    } catch (err) {
      const message = err instanceof Error ? err.message : "VRM 로드 실패";
      setError(message);
      setIsLoading(false);
      console.error("[VRM] 초기화 오류:", err);
    }
  }, []);

  const sendBase64Audio = useCallback((base64Audio: string) => {
    audioPlayerRef.current?.feedBase64Chunk(base64Audio);
  }, []);

  const setEmotion = useCallback((emotion: EmotionType, intensity: number) => {
    controllersRef.current.expression?.setEmotion(emotion, intensity);
  }, []);

  const close = useCallback(() => {
    // 컨트롤러 정리
    controllersRef.current.expression?.dispose();
    controllersRef.current.lipSync?.dispose();
    controllersRef.current.blink?.dispose();
    controllersRef.current.idle?.dispose();
    controllersRef.current = EMPTY_CONTROLLERS;
    setControllers(EMPTY_CONTROLLERS);

    // 오디오 정리
    audioPlayerRef.current?.dispose();
    audioPlayerRef.current = null;

    // VRM 정리
    if (vrmRef.current) {
      import("@pixiv/three-vrm").then(({ VRMUtils }) => {
        if (vrmRef.current) {
          VRMUtils.deepDispose(vrmRef.current.scene);
          vrmRef.current = null;
        }
      });
    }

    setIsInitialized(false);
    console.log("[VRM] 세션 종료");
  }, []);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      close();
    };
  }, [close]);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    sendBase64Audio,
    setEmotion,
    close,
    vrmRef,
    controllers,
  };
}
