"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

const natureAssets = [
  "/assets/3d-models/environment/kenney_hexagon-kit/Models/GLB format/grass.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-tall.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-autumn.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-autumn-tall.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/rock-a.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/rock-b.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/rock-c.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/resource-stone.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/resource-stone-large.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/grass.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/grass-large.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tent.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/campfire-pit.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/tree-log.glb",
  "/assets/3d-models/environment/kenney_survival-kit/Models/GLB format/structure-roof.glb"
];

const arenaAssets = [
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/floor.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/floor-detail.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/column.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/column-damaged.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/border-straight.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/wall.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/stairs.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/bricks.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/statue.glb",
  "/assets/3d-models/environment/kenney_mini-arena/Models/GLB format/weapon-rack.glb"
];

const petAssets = [
  "/assets/3d-models/pets/Cat.gltf",
  "/assets/3d-models/pets/Chick.gltf",
  "/assets/3d-models/pets/Chicken.gltf",
  "/assets/3d-models/pets/Dog.gltf",
  "/assets/3d-models/pets/Horse.gltf",
  "/assets/3d-models/pets/Pig.gltf",
  "/assets/3d-models/pets/Raccoon.gltf",
  "/assets/3d-models/pets/Sheep.gltf",
  "/assets/3d-models/pets/Wolf.gltf"
];

const characterAssets = [
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/floor-wood.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-wall.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-door-rotate.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-window-large.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-roof-snow.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/bench.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-snow-a.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-snow-b.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-snow-c.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/cabin-wall-roof.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snow-flat.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snow-flat-large.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snow-pile.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/snowman-hat.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/rocks-large.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/rocks-medium.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/rocks-small.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/sled.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/lights-colored.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/reindeer.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/wreath-decorated.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/tree-decorated-snow.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-a-cube.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-a-rectangle.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-a-round.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-b-cube.glb",
  "/assets/3d-models/environment/kenney_holiday-kit/Models/GLB format/present-b-rectangle.glb"
];

const playerModels = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r"
].map(id => `/assets/3d-models/characters/character-${id}.glb`);

export default function ScenePreloader() {
  useEffect(() => {
    natureAssets.forEach(asset => useGLTF.preload(asset));
    arenaAssets.forEach(asset => useGLTF.preload(asset));
    petAssets.forEach(asset => useGLTF.preload(asset));
    characterAssets.forEach(asset => useGLTF.preload(asset));
    playerModels.forEach(asset => useGLTF.preload(asset));
  }, []);

  return null;
}
