# Frontend Functional Pages

This document provides a comprehensive, code-level breakdown of the implementation patterns, state management, and user flows within the core interactive pages of the Questr application.

---

## Part 1: The Merchant's Shop (`/shop`)

The Shop is a high-interactivity hub that integrates server-side data fetching with snappy client-side state updates.

### 1. Data Orchestration (`ShopPage`)
The page follows the "Server-Focused" pattern of the Next.js App Router:
- **Parallel Fetching:** It uses `Promise.all` to fetch 6 different data points (catalog, inventory, profile, active pet) from Supabase in a single server-side execution.
- **Thematic Gating:** It retrieves the user's `activePlan` and filters the `shop_items` catalog to only show items that are universal or specific to that user's currently forged Legend.

### 2. Snappy Interaction (`ShopClientPage`)
To provide a game-like feel, the shop avoids full page reloads:
- **Optimistic State:** When a transaction occurs, the component immediately updates the `userCoins` and inventory counts in its local `useState`. This ensures the UI reflects the change instantly, even if the backend call takes a second.
- **Buy/Sell Toggle:** A central state variable `mode` toggles the entire UI between a catalog and a personal inventory view.
- **Species Filtering:** The component detects the `userPetSpecies` and filters the "Supplies" tab to only show food and toys compatible with that specific animal.

---

## Part 2: The Quest Log (`/log`)

The Quest Log is the primary daily dashboard for the user, acting as the main "Gameplay Loop."

### 1. The Task Interaction Engine (`TaskItem.tsx`)
This component handles the granular progression of the user's journey.
- **Optimistic Feedback:** When a task is checked, the UI immediately displays a toast with estimated XP and Coin rewards (`+X Coins, +Y XP`). This calculation is performed client-side using the same formula as the database trigger to ensure a seamless feel.
- **State Propagation:** It updates the `tasks` table via the Supabase client. This triggers the `handle_task_rewards` database logic.
- **Quest Completion:** If the component detects it is the `isLastTaskInQuest`, it automatically updates the parent `quests` record to `status: 'completed'`.
- **Pre-emptive Boss Generation:** A critical optimization. If the user completes the final task of **Day 6** in a module, the component pre-emptively invokes the `generate-boss-quiz` Edge Function. This ensures the AI has finished generating the quiz before the user even starts Day 7.
- **Oracle Deep-Linking:** Each task has an "Ask Oracle" button. Clicking this constructs a specific prompt containing the task's `title` and `short_description` and redirects the user to `/oracle?q=...`, providing instant, context-aware tutoring.

### 2. Journey Lifecycle Management (`BeginJourneyButton.tsx`)
Located at the bottom of the log, this component manages the transition between learning paths.
- **Quota Gating:** It enforces the weekly plan generation limits (1 for Free, 3 for Pro).
- **One-Off Purchases:** If a user has reached their limit, the button dynamically changes to a "Buy One-off Journey" CTA, which initiates a Stripe session via the `create-checkout` function.
- **Irreversible Actions:** It provides a confirmation dialog warning the user that starting a new journey will abandon their current progress (calling `abandon-active-plan`).

---

## Part 3: The Companion Hub (`/pet`)

The Pet page manages the companion's health and missions.

### 1. Real-Time Energy Heartbeat
- **Logic:** On mount, the page calls the `heartbeat_pet_energy` RPC. This ensures the user's energy regeneration is recalculated and persisted the moment they start looking at their pet.
- **State Polling:** If a pet is on a mission, the page likely uses a `setInterval` to countdown the mission timer and provide a "Claim" button once the duration is exceeded.

---

## Part 4: Technical Invariants & UX Patterns

### 1. Theme-Aware Assets
Components like `ShopItemCard` and `PetInventory` use a `mounted` check to safely access the `resolvedTheme` from `next-themes` without causing hydration mismatches. They then dynamically build paths:
`/items/${isDark ? 'white' : 'black'}/${asset_url}`

### 2. Scroll-Locked Layout
The functional pages use an `overflow-hidden` root container with `flex-1 overflow-y-auto` internal sections. This forces the navbar and mobile tabs to stay fixed in place while the content scrolls, mimicking the UX of a native iOS or Android app.

### 3. Custom Scrollbars
A global `.custom-scrollbar` utility is applied to scrolling containers to ensure the scrollbars match the dark/stylized RPG aesthetic of the app.
