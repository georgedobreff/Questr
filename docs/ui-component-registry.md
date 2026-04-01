# UI Component Registry

This document provides a comprehensive catalog of all custom React components in the Questr project, excluding the primitive primitives in `src/components/ui`.

---

## 1. Global & Infrastructure Components

### `ActivityTracker.tsx` (Headless)
- **Purpose:** Monitors user presence and updates local timezone metadata.
- **Logic:** Calls the `update_activity` RPC on mount and login events.

### `Navbar.tsx`
- **Purpose:** Primary responsive navigation.
- **Features:**
    - Desktop: Top bar with primary links and settings.
    - Mobile: Bottom tab bar and upward "More" menu.
    - State: Displays active streak and "Subscribe" CTAs.

### `NotificationsProvider.tsx` (Realtime)
- **Purpose:** Global listener for `notifications` table changes.
- **Logic:** Triggers `sonner` toasts for new `INSERT` events matching `auth.uid()`.

### `PasswordRecoveryHandler.tsx` (Headless)
- **Purpose:** Responds to `PASSWORD_RECOVERY` auth events.
- **Logic:** Automatically opens a reset password dialog when a user follows a reset link.

### `PWAProvider.tsx` / `InstallPWA.tsx`
- **Purpose:** Orchestrates the Progressive Web App lifecycle.
- **Features:** Platform detection (iOS vs Android), installation prompting, and standalone mode checks.

---

## 2. 3D & Environmental Components

### `CharacterViewer.tsx`
- **Purpose:** The standard container for rendering GLTF characters.
- **Props:** `modelPath`, `scale`, `position`, `activeAnimationName`, `autoCycleAnimations`.
- **Logic:** Uses `SkeletonUtils.clone` for safe instancing and manages cross-faded animations.

### `BossArena.tsx`
- **Purpose:** Specialized 3D scene for boss fights.
- **Props:** `playerModelPath`, `bossModelPath`, `playerHp`, `bossHp`, `playerAnimation`, `bossAnimation`.
- **Features:** Procedural circular floor generation and dynamic HP bar overlays.

### `ScenePreloader.tsx` (Headless)
- **Purpose:** Warms the browser cache for all 3D GLB/GLTF assets.
- **Logic:** Uses `useGLTF.preload` for lists of nature, arena, and character models.

---

## 3. Game & progression Components

### `TaskItem.tsx`
- **Purpose:** Individual checkable row in the Quest Log.
- **Props:** `task`, `plan_id`, `module_number`, `isLastTaskInQuest`.
- **Logic:** Optimistic reward toasts, DB updates, and pre-emptive boss generation on Day 6.

### `ProceduralMap.tsx`
- **Purpose:** Renders the seeded random journey path.
- **Logic:** LCG-based random walk algorithm using `plan.id` as a seed. Handles SVG pathing and collision-aware decorations.

### `BossFightDialog.tsx`
- **Purpose:** Orchestrates the quiz-combat encounter.
- **State:** Manages quiz index, local HP calculations, and result persistence.

### `PetInventory.tsx`
- **Purpose:** Grid display of pet consumables.
- **Logic:** Calls `use_pet_item` RPC and handles theme-aware icon paths.

---

## 4. Modals & Overlays

### `SubscriptionGuard.tsx`
- **Purpose:** The inescapable blocking modal for expired trials.
- **Logic:** Blocks interaction using `onPointerDownOutside` and `onEscapeKeyDown` until the user upgrades.

### `CharacterSelectorDialog.tsx`
- **Purpose:** 3D carousel for choosing a new avatar.
- **Logic:** Saves chosen `character_model_path` to the user's profile.

### `RevivePetDialog.tsx`
- **Purpose:** Displays penance progress for a dead pet.
- **Logic:** Displays the `X/3` modules completed counter and calls the `revive_pet` RPC.

---

## 5. UI Utilities

### `ForgingLoader.tsx` / `ChapterLoader.tsx`
- **Purpose:** Full-screen loaders with animated hammer/anvil and randomized narrative text strings.

### `TypingIndicator.tsx`
- **Purpose:** Animated dots used in Oracle and Adventure chat while the AI is generating.

### `ThemeToggle.tsx`
- **Purpose:** Button to switch between `light`, `dark`, and `system` modes.
