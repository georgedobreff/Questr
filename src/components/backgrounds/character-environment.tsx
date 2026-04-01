"use client";

import { useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import { useMemo, useLayoutEffect } from "react";
import { MathUtils, Color, Object3D, Mesh } from "three";

// kage bunshin no jutsu
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

export default function CharacterEnvironment() {
  const { scene } = useThree();

  useLayoutEffect(() => {
    scene.background = new Color('#87CEEB');
    return () => { scene.background = null; };
  }, [scene]);

  // Floor
  const floor = useGLTF("/assets/3d-models/environment/kenney_hexagon-kit/Models/GLB format/grass.glb");

  // Regular Trees
  const tree1 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree.glb");
  const tree2 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-tall.glb");
  const tree3 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-autumn.glb");
  const tree4 = useGLTF("/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-autumn-tall.glb");
  // Snow-covered Trees
  // const tree2 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-snow-a.glb");
  // const tree3 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-snow-b.glb");
  // const tree4 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-snow-c.glb");

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

  // Cabin Assets
  const cabinWall = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-wall.glb");
  const cabinDoor = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-door-rotate.glb");
  const cabinWindow = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-window-large.glb");
  const cabinRoof = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-roof.glb"); // Regular Roof
  // const cabinRoof = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-roof-snow.glb"); // Snow Roof
  const floorWood = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/floor-wood.glb");
  const cabinGable = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-wall-roof.glb");

  // Decorations
  const bench = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/bench.glb");
  //Snow-covered Rocks
  // const rocksLargeH = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/rocks-large.glb");
  // const rocksMediumH = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/rocks-medium.glb");
  // const rocksSmallH = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/rocks-small.glb");


  //  // Christmas Decorations
  //   const snowFlat = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snow-flat.glb");
  //   const snowFlatLarge = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snow-flat-large.glb");
  //   const snowPile = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snow-pile.glb");
  //   const snowmanHat = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snowman-hat.glb");
  //   const sled = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/sled.glb");
  //   const lights = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/lights-colored.glb");
  //   const reindeer = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/reindeer.glb");
  //   const wreathDecorated = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/wreath-decorated.glb");
  //   const treeDecoratedSnow = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-decorated-snow.glb");
  //   // Presents
  //   const present1 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-a-cube.glb");
  //   const present2 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-a-rectangle.glb");
  //   const present3 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-a-round.glb");
  //   const present4 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-b-cube.glb");
  //   const present5 = useGLTF("/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-b-rectangle.glb");


  const environment = useMemo(() => {
    const tiles = [];
    const props = [];
    const occupied: { x: number, z: number, r: number }[] = [];

    const gridSize = 24;

    // Adjusted for model scale
    const hexSize = 0.577;
    const xSpacing = Math.sqrt(3) * hexSize;
    const zSpacing = 1.5 * hexSize;

    // Calculate world radius based on grid size
    const worldRadius = gridSize * hexSize * 1.5;

    for (let r = -gridSize; r <= gridSize; r++) {
      const rOffset = Math.floor(r / 2.0);
      for (let q = -gridSize - rOffset; q <= gridSize - rOffset; q++) {

        // Offset coordinates to world space
        const zPos = r * zSpacing;
        const xPos = (q + (r % 2) * 0.5) * xSpacing;

        // Keep total area circular based on calculated world radius
        if (Math.sqrt(xPos * xPos + zPos * zPos) > worldRadius) continue;

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

        // Cabin exclusion zone
        const isInsideCabin = xPos > -8 && xPos < 8 && zPos > -12 && zPos < -4;

        const clearingRadius = 11;

        if (distFromCenter > clearingRadius && !isInsideCabin) {
          // TREES 
          const treeChance = distFromCenter > (clearingRadius + 2) ? 0.25 : 0.05;

          if (Math.random() < treeChance) {
            const model = treeModels[Math.floor(Math.random() * treeModels.length)];
            const scale = 1.6 + Math.random() * 6;
            // Collision radius at edge
            const radius = scale * (distFromCenter > 13 ? 0.1 : 0.2);

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
          // GRASS
          else if (Math.random() < (distFromCenter > 9 ? 0.8 : 0.3)) {
            const model = grassModels[Math.floor(Math.random() * grassModels.length)];

            // Random offset to make it look organic
            const xOffset = (Math.random() - 0.5) * 0.4;
            const zOffset = (Math.random() - 0.5) * 0.4;

            // Scale increases with distance
            const distFactor = Math.max(0, (distFromCenter - 8) / 10);
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

        // SNOW COVER GENERATION
        // We can repurpose this with grass or outright remove it when not in season.
        // if (!isInsideCabin && distFromCenter < 14) {
        //      const distToBench = Math.sqrt((xPos - (-3))**2 + (zPos - (-1.5))**2);

        //      // Bench area
        //      const isBenchFront = distToBench < 1.6 && zPos > -1.5 && zPos < 1.0; 

        //      // Clear path area
        //      const isPath = Math.abs(xPos) < 1.5 && zPos > -4;

        //      if (!isBenchFront && !isPath) {
        //          const snowProbability = xPos < -1 ? 0.20 : 0.40;

        //          if (Math.random() < snowProbability) {
        //              const snowModels = [snowFlat.scene, snowFlatLarge.scene, snowPile.scene];
        //              const model = snowModels[Math.floor(Math.random() * snowModels.length)];
        //              props.push(
        //                 <primitive
        //                     key={`snow-${r}-${q}`}
        //                     object={cloneWithShadows(model)}
        //                     position={[xPos, -0.18, zPos]}
        //                     scale={1.5 + Math.random()}
        //                     rotation={[0, Math.random() * Math.PI * 2, 0]}
        //                 />
        //              );
        //          }
        //      }
        // }
      }
    }
    return { tiles, props };
  }, [floor, treeModels, rockModels, grassModels,]); // to add snow - snowFlat, snowFlatLarge, snowPile

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

        {/* Cabin Construction */}
        <group position={[0, 0, -2.9]}>

          {/* Floor */}
          <primitive object={cloneWithShadows(floorWood.scene)} position={[0, 0, -6]} scale={3} />
          <primitive object={cloneWithShadows(floorWood.scene)} position={[-3, 0, -6]} scale={3} />
          <primitive object={cloneWithShadows(floorWood.scene)} position={[3, 0, -6]} scale={3} />
          <primitive object={cloneWithShadows(floorWood.scene)} position={[0, 0, -3]} scale={3} />
          <primitive object={cloneWithShadows(floorWood.scene)} position={[-3, 0, -3]} scale={3} />
          <primitive object={cloneWithShadows(floorWood.scene)} position={[3, 0, -3]} scale={3} />

          {/* Front Wall */}
          <primitive object={cloneWithShadows(cabinDoor.scene)} position={[0, 0, -3]} scale={3} />
          <primitive object={cloneWithShadows(cabinWindow.scene)} position={[-3, 0, -3]} scale={3} />
          <primitive object={cloneWithShadows(cabinWindow.scene)} position={[3, 0, -3]} scale={3} />

          {/* Side Walls */}
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[-6, 0, -3]} rotation={[0, Math.PI / 2, 0]} scale={3} />
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[6, 0, -3]} rotation={[0, -Math.PI / 2, 0]} scale={3} />
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[-6, 0, -6]} rotation={[0, Math.PI / 2, 0]} scale={3} />
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[6, 0, -6]} rotation={[0, -Math.PI / 2, 0]} scale={3} />

          {/* Gables */}
          <primitive object={cloneWithShadows(cabinGable.scene)} position={[-2, 3, 0]} rotation={[0, Math.PI, 0]} scale={[4, 3, 3]} />
          <primitive object={cloneWithShadows(cabinGable.scene)} position={[2, 3, -3]} rotation={[0, 0, 0]} scale={[4, 3, 3]} />

          {/* Back gables */}
          <primitive object={cloneWithShadows(cabinGable.scene)} position={[-2, 3, -6]} rotation={[0, Math.PI, 0]} scale={[4, 3, 3]} />
          <primitive object={cloneWithShadows(cabinGable.scene)} position={[2, 3, -10]} rotation={[0, 0, 0]} scale={[4, 3, 3]} />

          {/* Back Wall */}
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[0, 0, -6]} rotation={[0, Math.PI, 0]} scale={3} />
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[-3, 0, -6]} rotation={[0, Math.PI, 0]} scale={3} />
          <primitive object={cloneWithShadows(cabinWall.scene)} position={[3, 0, -6]} rotation={[0, Math.PI, 0]} scale={3} />

          {/* Roof */}
          <primitive object={cloneWithShadows(cabinRoof.scene)} position={[3.3, 2, -3]} scale={[3, 4, 4]} rotation={[0, 0, 0.4]} />
          <primitive object={cloneWithShadows(cabinRoof.scene)} position={[3.3, 2, -6]} scale={[3, 4, 4]} rotation={[0, 0, 0.4]} />

          <primitive object={cloneWithShadows(cabinRoof.scene)} position={[-3.3, 2, -3]} scale={[3, 4, 4]} rotation={[0, Math.PI, 0.4]} />
          <primitive object={cloneWithShadows(cabinRoof.scene)} position={[-3.3, 2, -6]} scale={[3, 4, 4]} rotation={[0, Math.PI, 0.4]} />
        </group>

        {/* Decorations */}
        <group position={[0, -0.2, 0]}>
          {/* House Decor */}
          <primitive object={cloneWithShadows(bench.scene)} position={[-3, 0, -1.5]} scale={1.69} />
          {/* Environment */}
          <primitive object={cloneWithShadows(rockA.scene)} position={[-4, 0, 8]} scale={1} />
          <primitive object={cloneWithShadows(rockB.scene)} position={[-5, 0, 9]} scale={1} />
          <primitive object={cloneWithShadows(rockC.scene)} position={[-2, 0, 7]} scale={1} />
          {/* 
        {/* Christmas Decor */}
          {/*<primitive object={cloneWithShadows(wreathDecorated.scene)} position={[-0.2, 3, -4]} scale={2} />
        <primitive object={cloneWithShadows(lights.scene)} position={[0, 4.5, -3.5]} scale={2} /> */}

          {/* Christmas Tree & Presents */}
          {/* <primitive object={cloneWithShadows(treeDecoratedSnow.scene)} position={[6.5, 0, 0]} scale={2} rotation={[0, 93 , 0]} />
        <primitive object={cloneWithShadows(present1.scene)} position={[6, 0, 0]} scale={2} rotation={[0, 0 , 0]} />
        <primitive object={cloneWithShadows(present2.scene)} position={[6.5, 0, -1]} scale={2} rotation={[0, 0 , 0]} />
        <primitive object={cloneWithShadows(present3.scene)} position={[7, 0, 1]} scale={2} rotation={[0, 0 , 0]} />
        <primitive object={cloneWithShadows(present4.scene)} position={[7, 0, 0]} scale={2} rotation={[0, 0 , 0]} />
        <primitive object={cloneWithShadows(present5.scene)} position={[6.9, 0, -1.4]} scale={2} rotation={[0, 0 , 0]} />
        <primitive object={cloneWithShadows(present2.scene)} position={[7.2, 0, 1]} scale={2} rotation={[0, 0 , 0]} /> */}

          {/* Snowman Area */}
          {/* <primitive object={cloneWithShadows(snowmanHat.scene)} position={[7, 0, 5]} scale={2} rotation={[0, 92 , 0]} />
        <primitive object={cloneWithShadows(snowFlat.scene)} position={[7, 0.05, 1]} scale={2} />
        <primitive object={cloneWithShadows(snowFlatLarge.scene)} position={[7, 0.05, 4]} scale={2} rotation={[0, 0.7, 0]}/>
        <primitive object={cloneWithShadows(snowFlatLarge.scene)} position={[5, 0.05, 5]} scale={2} rotation={[0, 0.2, 0]}/>
        <primitive object={cloneWithShadows(snowPile.scene)} position={[5, 0.05, 6]} scale={3} rotation={[0, 0.7, 0]}/>
         */}
          {/* Reindeer & Sled */}
          {/* <primitive object={cloneWithShadows(sled.scene)} position={[0, 0.2, 8]} scale={1.5} rotation={[0, 0 , 0]} />
        <primitive object={cloneWithShadows(reindeer.scene)} position={[-2, 0, 8]} scale={1.5} rotation={[0, Math.PI , 0]} /> */}
          {/* Snow-covered rocks */}
          {/*<primitive object={cloneWithShadows(rocksLargeH.scene)} position={[-4, 0, 8]} scale={1} />
        <primitive object={cloneWithShadows(rocksMediumH.scene)} position={[-5, 0, 9]} scale={1} />
        <primitive object={cloneWithShadows(rocksSmallH.scene)} position={[-2, 0, 7]} scale={1} />
        */}


        </group>

        <Environment preset="sunset" blur={1.5} />
      </group>
    </>
  );
}