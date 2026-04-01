# Procedural Journey Map

This document provides a comprehensive, code-level breakdown of the map generation and interaction system in Questr, explaining how the application creates a unique, navigable visual path for every user's learning journey.

---

## Part 1: Seeded Random Generation

The map is procedurally generated but remains consistent for each specific "Legend."

### 1. The Seeded PRNG
To ensure the map doesn't change every time the user refreshes, the generator uses a Linear Congruential Generator (LCG) seeded with the unique `plan.id`.
```javascript
function createRandom(seed: number) {
    let s = seed;
    return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };
}
```

### 2. Node Placement (Random Walk)
The algorithm iterates through the modules of the user's plan and performs a "Random Walk" to place nodes:
- **Step Constraints:** Each node is placed between 180 and 280 pixels from the previous one.
- **Angle Variance:** The direction of the next step varies by +/- 60 degrees from the previous heading.
- **Interleaving:** The logic automatically places a "Boss Fight" node immediately after every "Chapter" node.

---

## Part 2: Geometric & Collision Logic

To create a natural-looking world, the map populates the empty space with decorative assets.

### 1. Collision-Aware Decorations
The generator attempts to place 12 decorations (trees, rocks, lakes) per segment. It uses a **Distance-to-Segment** algorithm to ensure visual clarity:
- **Path Clearance:** Decorations must be at least 180 pixels away from the center of the road.
- **Node Clearance:** Decorations must be at least 150 pixels away from any interactive node.
- **Crowding Control:** Decorations must be at least 120 pixels away from each other.

### 2. SVG Bezier Pathing
The road connecting the nodes is a dynamic SVG path.
- **Path Generation:** It uses a Cubic Bezier curve (`C` command).
- **Control Point Calculation:** The logic calculates a midpoint between two nodes and uses it to define the curvature, creating a smooth "S" shape that follows the random walk heading.
- **Visual Layers:** The path is rendered in three SVG layers: a thick dark border (outer rails), a matching background-color fill (road surface), and a dashed center guide line.

---

## Part 3: Interaction Engine

The map is designed to behave like a physical artifact that the user can explore.

### 1. Draggable/Pannable Viewport
The interface implements a custom drag-to-scroll system:
- **State Tracking:** Monitors `isDragging`, `startPos`, and `scrollPos`.
- **Momentum-Aware:** It uses a movement threshold (5px) to distinguish between a "Click" (to open a node) and a "Drag" (to move the map).
- **Auto-Centering:** On initial load, the component calculates the position of the currently `active` node and automatically scrolls the viewport to center it.

### 2. Progress Summarization
The map includes a slide-out "Progress Sidebar" (`AnimatePresence`) that provides a hierarchical view of the journey:
- **Completed Chapters:** Groups completed quests by module number.
- **In-Depth View:** Uses a Shadcn/UI `Accordion` to let users expand specific days and see the AI-generated stories and completed task lists.

---

## Part 4: Visual Theming & Performance

### 1. Aesthetic Layering
- **Ancient Textures:** Uses a tiled parchment texture background from the Kenney Cartography Pack.
- **Blending:** Applies `mix-blend-multiply` (light) and `mix-blend-overlay` (dark) to merge the SVG path and node icons into the parchment texture.
- **Color Correction:** Uses CSS filters (`sepia`, `brightness`, `grayscale`) to unify the different asset packs into a cohesive, vintage style.

### 2. Technical Invariants
- **Coordinate Normalization:** After generation, the map calculates the global bounding box and applies a `padding` and `offset` to all nodes and decorations. This ensures that the generated map always starts at `(padding, padding)` and never has negative coordinates, which would break scrolling.
- **Memoization:** Node generation is wrapped in a `useEffect` that only fires when the `plan` or `completedModules` change, ensuring 60FPS interaction even on complex maps with hundreds of assets.
