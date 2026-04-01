"use client";

import { useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import { useMemo, useLayoutEffect } from "react";
import { MathUtils, Color, Object3D, Mesh } from "three";

// Reusing the shadow cloning logic
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

export default function NatureEnvironment() {
  const { scene } = useThree();

  useLayoutEffect(() => {
    scene.background = new Color('#87CEEB');
    return () => { scene.background = null; };
  }, [scene]);

  // Floor
  const floor = useGLTF("/assets/3d-models/environment/kenney_hexagon-kit/Models/GLB format/grass.glb");

  // Trees
  const tree1 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree.glb");
  const tree2 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-tall.glb");
  const tree3 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-autumn.glb");
  const tree4 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-autumn-tall.glb");
  const treeModels = useMemo(() => [tree1.scene, tree2.scene, tree3.scene, tree4.scene], [tree1, tree2, tree3, tree4]);

  // Rocks
  const rockA = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/rock-a.glb");
  const rockB = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/rock-b.glb");
  const rockC = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/rock-c.glb");
  const stone = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/resource-stone.glb");
  const stoneLarge = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/resource-stone-large.glb");
  const rockModels = useMemo(() => [rockA.scene, rockB.scene, rockC.scene, stone.scene, stoneLarge.scene], [rockA, rockB, rockC, stone, stoneLarge]);

  // Grass
  const grass = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/grass.glb");
  const grassLarge = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/grass-large.glb");
  const grassModels = useMemo(() => [grass.scene, grassLarge.scene], [grass, grassLarge]);

  // Decor
  const tent = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tent.glb");
  const campfire = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/campfire-pit.glb");
  const log = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-log.glb");
  const shelter = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/structure-roof.glb");

  const environment = useMemo(() => {
    const tiles = [];
    const props = [];
    const occupied: { x: number, z: number, r: number }[] = [];

    const gridSize = 16;

    // Adjusted for model scale (Likely Radius 0.5 / Width 1)
    const hexSize = 0.577;
    const xSpacing = Math.sqrt(3) * hexSize;
    const zSpacing = 1.5 * hexSize;

    for (let r = -gridSize; r <= gridSize; r++) {
      const rOffset = Math.floor(r / 2.0);
      for (let q = -gridSize - rOffset; q <= gridSize - rOffset; q++) {

        // Offset coordinates to world space
        const zPos = r * zSpacing;
        const xPos = (q + (r % 2) * 0.5) * xSpacing;

        // Keep total area similar (Increased to 14 for dense edge)
        if (Math.sqrt(xPos * xPos + zPos * zPos) > 14) continue;

        tiles.push(
          <primitive
            key={`hex-${r}-${q}`}
            object={cloneWithShadows(floor.scene)}
            position={[xPos, -0.2, zPos]}
            rotation={[0, 0, 0]}
            scale={[1, 1, 1]}
          />
        );

        const distFromCenter = Math.sqrt(xPos * xPos + zPos * zPos);

        // CLEARING
        if (distFromCenter > 6) {
          // TREES - Dense Edge Logic
          const treeChance = distFromCenter > 9 ? 0.9 : 0.25;

          if (Math.random() < treeChance) {
            const model = treeModels[Math.floor(Math.random() * treeModels.length)];
            // Min scale 1.6 (same as before), Max scale 7.6 (much taller)
            const scale = 1.6 + Math.random() * 6;
            // Tighter collision radius at edge (0.1) vs center (0.2) to allow packing
            const radius = scale * (distFromCenter > 11 ? 0.1 : 0.2);

            let collision = false;
            for (const o of occupied) {
              const d = Math.sqrt((xPos - o.x) ** 2 + (zPos - o.z) ** 2);
              if (d < radius + o.r) {
                collision = true;
                break;
              }
            }

            if (!collision) {
              props.push(
                <primitive
                  key={`tree-${r}-${q}`}
                  object={cloneWithShadows(model)}
                  position={[xPos, -0.2, zPos]}
                  scale={scale}
                  rotation={[0, Math.random() * Math.PI * 2, 0]}
                />
              );
              occupied.push({ x: xPos, z: zPos, r: radius });
            }
          }
          // ROCKS
          else if (Math.random() < 0.08) {
            const model = rockModels[Math.floor(Math.random() * rockModels.length)];
            props.push(
              <primitive
                key={`rock-${r}-${q}`}
                object={cloneWithShadows(model)}
                position={[xPos, -0.2, zPos]}
                scale={0.5 + Math.random() * 0.5}
                rotation={[0, Math.random() * Math.PI * 2, 0]}
              />
            );
          }
          // GRASS - Scattered (Higher density at edges)
          else if (Math.random() < (distFromCenter > 9 ? 0.8 : 0.3)) {
            const model = grassModels[Math.floor(Math.random() * grassModels.length)];

            // Random offset to make it look organic
            const xOffset = (Math.random() - 0.5) * 0.4;
            const zOffset = (Math.random() - 0.5) * 0.4;

            // Scale increases with distance
            const distFactor = Math.max(0, (distFromCenter - 4.5) / 10);
            const minScale = 1.5 + distFactor * 3.0;
            const scaleRange = 4.5 + distFactor * 2.0;
            const scale = minScale + Math.random() * scaleRange;

            props.push(
              <primitive
                key={`grass-${r}-${q}`}
                object={cloneWithShadows(model)}
                position={[xPos + xOffset, 0, zPos + zOffset]}
                scale={scale}
                rotation={[0, Math.random() * Math.PI * 2, 0]}
              />
            );
          }
        }
      }
    }
    return { tiles, props };
  }, [floor, treeModels, rockModels, grassModels]);

  return (
    <>
      <group position={[0, -2.5, 0]} scale={3}>
        <ambientLight intensity={0.8} />

        <hemisphereLight intensity={0.5} color="#e0dbd0ff" groundColor="#475569" />
        <directionalLight
          position={[45, 50, 20]}
          intensity={1.5}
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

        {environment.tiles}
        {environment.props}

        {/* Shelter Roof - Lowered and Rotated */}
        <primitive
          object={cloneWithShadows(shelter.scene)}
          position={[0, 0, 0]}
          scale={6}
          rotation={[0, -Math.PI / 2, 0]}
        />

        {/* Decor in the clearing */}
        <primitive object={cloneWithShadows(rockA.scene)} position={[2.5, 0, -2]} scale={3.5} rotation={[0, 1, 0]} />
        <primitive object={cloneWithShadows(stone.scene)} position={[3, 0, -1]} scale={3} rotation={[0, 2, 0]} />

        <primitive object={cloneWithShadows(tent.scene)} position={[2.5, 0, 2.5]} rotation={[0, -0.8, 0]} scale={1.5} />
        <primitive object={cloneWithShadows(campfire.scene)} position={[-2, 0, 2]} scale={4} />
        <primitive object={cloneWithShadows(log.scene)} position={[-2.5, 0.1, 3]} rotation={[0, 0.5, 0]} scale={0.8} />

        {/* Scattered Logs */}
        <primitive object={cloneWithShadows(log.scene)} position={[-3.2, 0.1, 2.3]} rotation={[0, 1.2, 0]} scale={0.8} />
        <primitive object={cloneWithShadows(log.scene)} position={[-4.6, 0.1, 2.2]} rotation={[0, 0.6, 0]} scale={1.5} />
        <primitive object={cloneWithShadows(log.scene)} position={[-3.0, 0.1, 1.5]} rotation={[0, -0.1, 0]} scale={0.5} />

        <Environment preset="sunset" blur={1.5} />
      </group>
    </>
  );
}