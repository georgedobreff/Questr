"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { Vector3, Group, Object3D, LoopOnce, Box3, LightShadow, PCFSoftShadowMap, Mesh } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { cn } from "@/lib/utils";

interface BossArenaProps {
  playerModelPath: string;
  bossModelPath: string;
  playerHp: number;
  bossHp: number;
  playerAnimation: string;
  bossAnimation: string;
  onAnimationComplete?: (who: 'player' | 'boss', anim: string) => void;
  className?: string;
}

interface FighterProps {
  modelPath: string;
  position: [number, number, number];
  rotation: [number, number, number];
  animation: string;
  onAnimationComplete?: (anim: string) => void;
  scale?: number;
  isBoss?: boolean;
}

function Fighter({
  modelPath,
  position,
  rotation,
  animation,
  onAnimationComplete,
  scale = 1.8,
  isBoss = false
}: FighterProps) {
  const group = useRef<Group>(null);
  const { scene, animations: modelAnims } = useGLTF(modelPath);

  const modelScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions, names } = useAnimations(modelAnims, group);

  const onAnimationCompleteRef = useRef(onAnimationComplete);
  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);


  useEffect(() => {
    if (modelScene) {
      modelScene.traverse((child) => {
        if ((child as Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      modelScene.position.y = 0;
    }
  }, [modelScene]);


  useEffect(() => {
    let animName = 'Idle';
    const findAnim = (query: string) => names.find(n => n.toLowerCase().includes(query.toLowerCase()));

    if (animation === 'Attack') {
      animName = findAnim('attack') || findAnim('interact') || findAnim('punch') || 'Idle';
    } else if (animation === 'Hit') {
      animName = findAnim('hit') || findAnim('damage') || 'Idle';
    } else if (animation === 'Death') {
      animName = findAnim('death') || findAnim('die') || 'Idle';
    } else {
      animName = findAnim('idle') || names[0];
    }

    const action = actions[animName];
    if (action) {
      const isDeath = animation === 'Death';

      action.reset().fadeIn(0.2).setLoop(animation === 'Idle' ? 2201 : LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();

      if (isDeath) return;

      const onFinished = () => {
        if (onAnimationCompleteRef.current && animation !== 'Idle') {
          onAnimationCompleteRef.current(animation);
        }
      };

      const mixer = action.getMixer();
      mixer.addEventListener('finished', onFinished);

      return () => {
        action.fadeOut(0.2);
        mixer.removeEventListener('finished', onFinished);
      };
    }
  }, [animation, actions, names]);

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale} dispose={null}>
      <primitive object={modelScene} />
    </group>
  );
}

function Arena() {
  const floor = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/floor.glb");
  const floorDetail = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/floor-detail.glb");
  const column = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/column.glb");
  const columnDamaged = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/column-damaged.glb");
  const wall = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/border-straight.glb");
  const outerWall = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/wall.glb");
  const stairs = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/stairs.glb");
  const bricks = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/bricks.glb");
  const statue = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/statue.glb");
  const weaponRack = useGLTF("/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/weapon-rack.glb");

  const ARENA_SCALE = 10;
  const RADIUS = 9;
  const SECTIONS = 96;

  const cloneWithShadows = (scene: Object3D) => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  };

  const arenaContent = useMemo(() => {
    const tiles = [];
    for (let i = 0; i < RADIUS * 2 + 2; i++) {
      const x = i - RADIUS;
      for (let j = 0; j < RADIUS * 2 + 2; j++) {
        const z = j - RADIUS;
        const dist = Math.sqrt(x * x + z * z);
        if (dist > RADIUS + 1) continue;

        tiles.push(
          <primitive
            key={`${x}-${z}`}
            object={(x === 0 && z === 0) ? cloneWithShadows(floorDetail.scene) : cloneWithShadows(floor.scene)}
            position={[x, 0, z]}
          />
        );
      }
    }

    const wallSections = [];
    for (let i = 0; i < SECTIONS; i++) {
      const angle = (i / SECTIONS) * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const rotationY = -angle + Math.PI / 2;

      wallSections.push(
        <group key={`section-${i}`}>
          <primitive object={cloneWithShadows(wall.scene)} position={[x * 8, 0, z * 8]} rotation={[0, rotationY, 0]} />
          <primitive object={cloneWithShadows(wall.scene)} position={[x * 8, 0.5, z * 8]} rotation={[0, rotationY, 0]} />

          <primitive object={cloneWithShadows(stairs.scene)} position={[x * 9, 0.2, z * 9]} rotation={[0, rotationY, 0]} />
          <primitive object={cloneWithShadows(stairs.scene)} position={[x * 10, 0.7, z * 10]} rotation={[0, rotationY, 0]} />
          <primitive object={cloneWithShadows(stairs.scene)} position={[x * 11, 1.2, z * 11]} rotation={[0, rotationY, 0]} />

          <primitive object={cloneWithShadows(outerWall.scene)} position={[x * 12, 0, z * 12]} rotation={[0, rotationY, 0]} scale={[1, 3, 1]} />
        </group>
      );
    }

    return { tiles, walls: wallSections };
  }, [floor, floorDetail, wall, outerWall, stairs]);

  return (
    <group position={[0, 0, 0]} scale={ARENA_SCALE}>
      {arenaContent.tiles}
      {arenaContent.walls}

      <group position={[0, 0, -7.5]}>
        <primitive object={cloneWithShadows(column.scene)} scale={[1, 1.2, 1]} position={[0, 0, 0]} />
        <primitive object={cloneWithShadows(statue.scene)} position={[0, 1.2, 0]} rotation={[0, 0, 0]} />
      </group>

      <primitive object={cloneWithShadows(columnDamaged.scene)} position={[-5.5, 0, -4]} rotation={[0, 0.5, 0]} scale={[1, 1.8, 1]} />
      <primitive object={cloneWithShadows(columnDamaged.scene)} position={[6.2, 0, 3.5]} rotation={[0, -0.8, 0]} scale={[1, 1.5, 1]} />

      <primitive object={cloneWithShadows(weaponRack.scene)} position={[-3, 0, -7]} rotation={[0, 0.4, 0]} />
      <primitive object={cloneWithShadows(weaponRack.scene)} position={[3, 0, -7]} rotation={[0, -0.4, 0]} />

      <primitive object={cloneWithShadows(bricks.scene)} position={[-4, 0, 1.5]} rotation={[0, 0.5, 0]} />
      <primitive object={cloneWithShadows(bricks.scene)} position={[4.2, 0, -1.2]} rotation={[0, -0.5, 0]} />
      <primitive object={cloneWithShadows(bricks.scene)} position={[0.5, 0, 6.5]} rotation={[0, 1.5, 0]} />
      <primitive object={cloneWithShadows(bricks.scene)} position={[-6.2, 0, -2.5]} rotation={[0, 0.2, 0]} />
      <primitive object={cloneWithShadows(bricks.scene)} position={[6.5, 0, 4.2]} rotation={[0, -0.9, 0]} />
    </group>
  );
}

export default function BossArena({
  playerModelPath,
  bossModelPath,
  playerHp,
  bossHp,
  playerAnimation,
  bossAnimation,
  onAnimationComplete,
  className
}: BossArenaProps) {
  return (
    <div className={cn("relative w-grow h-[350px] sm:h-[500px] bg-sky-100 rounded-xl overflow-hidden shadow-sm", className)}>

      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 text-slate-900">
        <div className="w-1/3 space-y-1">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
            <span>You</span>
            <span>{playerHp}/100</span>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300">
            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${Math.max(0, playerHp)}%` }} />
          </div>
        </div>
        <div className="pt-1"><span className="text-2xl font-black italic text-slate-900/20">VS</span></div>
        <div className="w-1/3 space-y-1">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
            <span>Enemy</span>
            <span>{bossHp}/100</span>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300">
            <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${Math.max(0, bossHp)}%` }} />
          </div>
        </div>
      </div>

      <Canvas shadows={{ type: PCFSoftShadowMap }} camera={{ position: [0, 10, 20], fov: 50 }}>
        <color attach="background" args={['#cbd5e1']} />
        <ambientLight intensity={0.8} />
        <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#475569" />
        <directionalLight
          position={[45, 50, 20]}
          intensity={0.8}
          castShadow
          shadow-intensity={1}
          shadow-radius={10}
          shadow-bias={-0.0001}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />

        <Suspense fallback={null}>
          <Arena />

          <Fighter
            modelPath={playerModelPath}
            position={[-2.5, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            animation={playerAnimation}
            onAnimationComplete={(anim) => onAnimationComplete?.('player', anim)}
            scale={1.8}
          />

          <Fighter
            modelPath={bossModelPath}
            position={[2.5, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            animation={bossAnimation}
            onAnimationComplete={(anim) => onAnimationComplete?.('boss', anim)}
            scale={2.2}
            isBoss={true}
          />

          <Environment preset="dawn" blur={0.8} />
          <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2.1} minPolarAngle={Math.PI / 3} target={[0, 4, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}