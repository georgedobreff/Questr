# 3D Technical Pipeline

This document provides a comprehensive, code-level breakdown of the 3D rendering engine in Questr, built on React Three Fiber (R3F), Drei, and Three.js.

---

## Part 1: Resource Management (`ScenePreloader`)

Questr uses a proactive caching strategy to ensure the application feels like a high-performance game.

### The Headless Preloader
The `ScenePreloader.tsx` component is rendered at the root level. It uses the `useGLTF.preload` utility to asynchronously download and parse models into memory before they are ever requested by a UI component.
- **Asset Groups:** It manages distinct lists for Nature, Arena, Holiday, Pets, and the 18 unique Player models.
- **UX Impact:** This prevents "pop-in" where models appear white or invisible for several seconds while loading.

---

## Part 2: Scene Instancing & Skeleton Cloning

A critical technical challenge in R3F is rendering multiple instances of the same model with different states.

### `SkeletonUtils.clone()`
In the `CharacterViewer` and `BossArena` components, models are cloned using `SkeletonUtils.clone(scene)`.
- **The Problem:** Standard GLTF loading in Three.js returns a reference to a single shared scene graph.
- **The Solution:** Cloning ensures that each component has its own unique copy of the model's bones and meshes. This allows the player character to play an "Idle" animation while an enemy in the same scene plays a "Hit" animation, without interference.

---

## Part 3: Animation State Machine

Animations are managed via the `useAnimations` hook and custom `useEffect` logic that acts as a simple state machine.

### Key Logic:
- **Cross-Fading:** Transitions between animations (e.g., from `Idle` to `Attack`) use `.fadeIn(0.2)` and `.fadeOut(0.2)` to prevent "snapping."
- **Loop Control:**
    - **Idle:** Loops infinitely.
    - **Action (Hit/Attack):** Uses `setLoop(LoopOnce, 1)` and `clampWhenFinished = true` to play exactly once.
    - **Death:** Special handling. The animation plays once and the logic **skips** the cleanup phase to ensure the model stays collapsed on the floor.
- **Heuristic Matching:** Since Kenney assets use varying names, the components use case-insensitive string matching (`.includes('walk')`, `.includes('die')`) to find the correct animation index.

---

## Part 4: Lighting & Shadow Configuration

Questr uses a sophisticated lighting rig to achieve its vibrant, stylized look.

### 1. Global Illumination
- **`ambientLight`**: Provides base visibility.
- **`hemisphereLight`**: Simulates outdoor lighting by using a sky color (white) and a ground-bounce color (slate-grey).
- **`Environment`**: Uses the `dawn` preset with a `0.8` blur to provide realistic metallic reflections on armor and weapons.

### 2. High-Fidelity Shadows
- **`directionalLight`**: Configured as the primary shadow caster.
- **Resolution:** Uses a `2048 x 2048` map size for sharp shadows.
- **Camera Frustum:** The shadow camera is tightly clamped (`[-25, 25]`) to the arena size to maximize shadow detail.
- **Smoothing:** Uses `PCFSoftShadowMap` for softened, realistic edges.

---

## Part 5: Procedural Arena Construction

The `Arena` component in `BossArena.tsx` demonstrates procedural world-building.
- **Trigonometric Layout:** It uses a loop over 96 sections, calculating `x` and `z` coordinates using `Math.cos(angle)` and `Math.sin(angle)` to create a perfectly circular boundary of walls and stairs.
- **Memoization:** The entire arena geometry is wrapped in `useMemo` to prevent expensive re-cloning and coordinate recalculation on every frame, ensuring 60FPS performance even on mobile devices.
