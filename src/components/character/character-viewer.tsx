"use client";

import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { type Object3D, LoopOnce, PCFSoftShadowMap, Mesh } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelProps {
  modelPath: string;
  scale?: number;
  position?: [number, number, number];
  currentAnimation?: string;
  onAnimationsLoaded?: (animations: string[]) => void;
  playDeathAnimation?: boolean;
}

function Model({
  modelPath,
  scale = 1,
  position = [0, -2.5, 0],
  currentAnimation,
  onAnimationsLoaded,
  playDeathAnimation
}: ModelProps) {
  const ref = useRef<Object3D>(null);
  const { scene, animations } = useGLTF(modelPath);

  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const { actions, names } = useAnimations(animations, ref);
  const previousAnimation = useRef<string | undefined>(undefined);
  const hasPlayedDeath = useRef(false);


  useEffect(() => {
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [clone]);

  useEffect(() => {
    if (onAnimationsLoaded && names.length > 0) {
      onAnimationsLoaded(names);
    }
  }, [names, onAnimationsLoaded]);

  useEffect(() => {
    if (playDeathAnimation) {
      if (hasPlayedDeath.current) return;

      const deathAnimName = names.find(name => name.toLowerCase().includes('death') || name.toLowerCase().includes('die'));
      if (deathAnimName && actions[deathAnimName]) {
        const action = actions[deathAnimName];

        if (previousAnimation.current && actions[previousAnimation.current]) {
          actions[previousAnimation.current]?.fadeOut(0.5);
        }

        action.reset().fadeIn(0.5).setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();

        previousAnimation.current = deathAnimName;
        hasPlayedDeath.current = true;
        return;
      }
    }

    const findActionName = (name: string) => names.find(n => n.toLowerCase() === name.toLowerCase());
    const walkAnimName = findActionName('walk');

    let animToPlay = currentAnimation ? findActionName(currentAnimation) : walkAnimName;

    if (!animToPlay) {
      animToPlay = walkAnimName || names[0];
    }

    if (!animToPlay || !actions[animToPlay]) return;

    const action = actions[animToPlay];
    if (!action) return;

    const prevAction = previousAnimation.current ? actions[previousAnimation.current] : null;

    if (previousAnimation.current !== animToPlay) {
      if (prevAction) {
        prevAction.fadeOut(0.5);
      }

      action.reset().fadeIn(0.5).play();

      // Speed adjustment for walk animation
      /*
      if (animToPlay.toLowerCase().includes('walk')) {
        action.timeScale = 0.5;
      } else {
        action.timeScale = 1;
      }
      */

      previousAnimation.current = animToPlay;
    }
  }, [actions, currentAnimation, names, playDeathAnimation]);

  return (
    <group scale={scale} position={position}>
      <primitive ref={ref} object={clone} />
    </group>
  );
}

interface CharacterViewerProps {
  modelPath: string;
  enableControls?: boolean;
  autoRotate?: boolean;
  className?: string;
  autoCycleAnimations?: boolean;
  allowedAnimations?: string[];
  autoCycleInterval?: number;
  playDeathAnimation?: boolean;
  scale?: number;
  position?: [number, number, number];
  children?: React.ReactNode;
  disableDefaultLights?: boolean;
  defaultPlaying?: boolean;
  activeAnimationName?: string;
  isPlaying?: boolean;
  initialCameraPosition?: [number, number, number];
}

export default function CharacterViewer({
  modelPath,
  enableControls = false,
  autoRotate = false,
  className,
  autoCycleAnimations = false,
  allowedAnimations,
  autoCycleInterval = 15000,
  playDeathAnimation = false,
  scale = 1.8,
  position = [0, -2.5, 0],
  children,
  disableDefaultLights = false,
  defaultPlaying = true,
  activeAnimationName,
  isPlaying: isPlayingProp,
  initialCameraPosition = [0, 0, 5]
}: CharacterViewerProps) {
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);
  const [internalIsPlaying, setInternalIsPlaying] = useState(defaultPlaying);
  const [autoAnimation, setAutoAnimation] = useState<string | null>(null);

  const isPlaying = isPlayingProp !== undefined ? isPlayingProp : internalIsPlaying;

  const walkAnimationName = activeAnimationName || availableAnimations.find(name => name.toLowerCase().includes('walk')) || 'walk';
  const staticAnimationName = availableAnimations.find(name => name.toLowerCase() === 'static' || name.toLowerCase() === 'idle') || 'static';
  let currentAnimation = isPlaying ? walkAnimationName : staticAnimationName;

  useEffect(() => {
    if (!autoCycleAnimations || availableAnimations.length === 0 || playDeathAnimation) return;

    let timeoutId: NodeJS.Timeout;

    const findAnim = (query: string) => availableAnimations.find(name => name.toLowerCase().includes(query.toLowerCase()));
    const filterAnims = (queries: string[]) => availableAnimations.filter(name =>
      queries.some(q => name.toLowerCase().includes(q.toLowerCase()))
    );

    const idleAnim = findAnim('idle') || findAnim('static') || availableAnimations[0];
    const activeAnims = filterAnims(['walk', 'run']);

    const runCycle = () => {
      setAutoAnimation(idleAnim);
      const idleDuration = 15000 + Math.random() * 10000;

      timeoutId = setTimeout(() => {
        if (activeAnims.length > 0) {
          const randomActive = activeAnims[Math.floor(Math.random() * activeAnims.length)];
          setAutoAnimation(randomActive);
          timeoutId = setTimeout(runCycle, 10000);
        } else {
          runCycle();
        }
      }, idleDuration);
    };

    runCycle();

    return () => clearTimeout(timeoutId);
  }, [autoCycleAnimations, availableAnimations, playDeathAnimation]);

  if (autoCycleAnimations && autoAnimation) {
    currentAnimation = autoAnimation;
  }

  const hasWalk = availableAnimations.some(name => name.toLowerCase().includes('walk'));
  const hasStatic = availableAnimations.some(name => name.toLowerCase() === 'static' || name.toLowerCase() === 'idle');

  return (
    <div className={cn("relative w-full h-64 rounded-lg overflow-hidden", className)}>
      <Canvas shadows={{ type: PCFSoftShadowMap }} camera={{ position: initialCameraPosition }}>
        {!disableDefaultLights && (
          <>
            <ambientLight intensity={1.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
            <pointLight position={[-10, -10, -10]} />
            <directionalLight position={[5, 10, 7.5]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />
          </>
        )}
        <Suspense fallback={null}>
          <Model
            key={modelPath}
            modelPath={modelPath}
            scale={scale}
            position={position}
            currentAnimation={currentAnimation}
            onAnimationsLoaded={setAvailableAnimations}
            playDeathAnimation={playDeathAnimation}
          />
          {children}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={autoRotate}
            autoRotateSpeed={10}
            minDistance={5}
            maxDistance={14}
            maxPolarAngle={Math.PI / 2 - 0.2}
            minPolarAngle={Math.PI / 2 - 0.2}
          />
        </Suspense>
      </Canvas>

    </div>
  );
}