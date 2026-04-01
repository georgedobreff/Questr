# Theming & Visual Assets

This document provides a comprehensive, code-level breakdown of the visual identity, asset conventions, and styling configuration of the Questr application.

---

## Part 1: Visual Identity & Assets

Questr leverages high-quality, game-ready assets from the **Kenney** library (CC0) to create its unique RPG aesthetic. The project systematically integrates multiple specialized kits:

### 1. 3D Model Kits (`public/`)

| Kit Name | Content | Application |
|:---|:---|:---|
| `kenney_blocky-characters_20` | 18 humanoid variants | The primary user avatar system. Referenced in `profiles.character_model_path`. |
| `kenney_mini-arena` | Floor tiles, columns, statues | Procedurally assembled in `BossArena.tsx` to create the circular combat floor. |
| `kenney_hexagon-kit` | Hexagonal terrain blocks | Used for the base level of environmental rendering. |
| `kenney_modular-dungeon-kit` | Walls, gates, traps | Provides the modular assets for the AI Adventure DM's dungeons. |
| `kenney_platformer-kit` | Floating platforms, trees | Used in various 3D background dioramas. |
| `kenney_survival-kit` | Tents, campfires, rocks | Used to decorate the `CharacterEnvironment` and pet scenes. |
| `kenney_holiday-kit` | Snowy assets, cabins | Provides the winter-themed environment for character management pages. |

### 2. UI & 2D Assets

- **`kenney_cartography-pack`**: The foundational kit for the **Procedural Journey Map**. It provides the parchment textures, node icons (Castles, Houses), and decorative elements (Pine trees, mountain rocks).
- **`kenney_cursor-pack`**: Overrides the standard browser pointer globally.
    - **Light Mode:** Uses ` tool_sword_b.png` from the `Outline` variant.
    - **Dark Mode:** Uses ` tool_sword_b.png` from the `Basic` variant.
- **Items & Achievements**:
    - Icons are provided in both `black/` and `white/` subdirectories to ensure perfect contrast in both light and dark modes. The frontend component selects the correct path dynamically based on the current theme.

---

## Part 2: The Forging Loader (`ForgingLoader.tsx`)

A unique, highly-thematic loading component used during heavy AI operations (Plan Generation, Dungeon Clearing).

### 1. Visual Logic
- **Anvil and Hammer:** Uses the `anvil.png` and `3d-hammer.png` assets.
- **Animation:** The hammer uses the custom `animate-hammer` keyframes (defined in `globals.css`) to simulate a blacksmith's strike.
- **Theme Awareness:** Dynamically switches between the `black` and `white` asset folders based on `resolvedTheme`.

### 2. Narrative Engagement
To mask the high-latency of LLM generation, the loader cycles through a list of **14 randomized fantasy messages** (e.g., "Consulting the High Elves...", "Summoning the Syllabus Spirit...").
- **Rotation:** Messages change every 5 seconds to maintain user engagement during long-running tasks.

---

## Part 3: Styling Engine (Tailwind 4 & CSS)

Questr uses the latest **Tailwind CSS 4** features, moving configuration closer to the CSS layer.

### 1. Theming Strategy (`src/app/globals.css`)
- **Color Model:** Uses **OKLCH** colors for high perceptual consistency and vibrant tones in both light and dark modes.
- **CSS Variables:** All theme colors (`primary`, `secondary`, `card`, `destructive`) are defined as CSS variables and mapped into the Tailwind theme.
- **Dark Mode:** Implemented via the `.dark` class, with specific variable overrides.

### 2. Custom Animations
The app features several bespoke CSS animations to provide life to the interface:
- **`animate-hammer`:** A rotating transformation used primarily in "Forging" or loading states.
- **`animate-pulsate-orange`:** A glowing box-shadow effect used for primary Calls to Action (CTAs), such as the "Subscribe to continue" button.
- **`bg-dot-pattern`:** A custom radial gradient utility that creates a subtle, retro RPG background grid.

---

## Part 3: Component Library (Shadcn/UI)

The project uses **Shadcn/UI** as its foundation.
- **Customization:** Components in `src/components/ui` are fully customized to fit the Questr theme (e.g., specific border radiuses, shadow styles, and font sizes).
- **Accessibility:** Radix primitives ensure that even complex interactive components like Dialogs and Dropdowns are accessible.

---

## Part 4: Implementation Invariants

- **Themed Assets:** When adding new item icons, always provide both a light and dark version in the respective `/items` subfolders.
- **Cursor Override:** The global cursor override is defined in the `@layer base` of `globals.css`. If a specific component needs a standard pointer, it must explicitly use `cursor-pointer !important`.
- **Preloading:** Large 3D models and textures are managed by the `ScenePreloader` component to prevent "pop-in" and ensure a smooth visual experience.
