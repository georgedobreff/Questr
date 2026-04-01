# Frontend State & Data Flow Strategy

This document provides a comprehensive, code-level breakdown of the architectural decisions governing state management and data synchronization in the Questr frontend.

---

## Part 1: The "No Global Context" Architecture

A significant decision in Questr is the **omission of global state managers** (like Redux, Zustand, or a massive React Context provider).

### 1. Why this approach?
- **Server-Centricity:** By leveraging Next.js Server Components, the "State of Truth" remains the database. Data is fetched fresh on every navigation, eliminating the risk of stale client-side caches.
- **Complexity Reduction:** Each feature (Shop, Pet, Log) is self-contained. A bug in the Pet system's state cannot cascade and crash the Quest Log.
- **PWA Readiness:** Localized state is easier to persist and restore during offline/online transitions in a Progressive Web App.

### 2. How data is shared?
- **Server Actions & `router.refresh()`:** When a user performs an action (e.g., completes a task), the client sends an update to Supabase and then calls `router.refresh()`. This triggers Next.js to re-render all Server Components on the current page with fresh data.
- **URL as State:** Tabs, filtering, and deep-links are managed via URL Search Parameters (`useSearchParams`), ensuring the UI state is shareable and refresh-proof.

---

## Part 2: Real-Time Synchronization

While state is localized, the app remains "Live" through the **Realtime Engine**.

### 1. Headless Synchronization
Components like `quest-refresh-listener.tsx` run in the background.
- **Logic:** They subscribe to specific Supabase Realtime channels (e.g., `task-updates-${planId}`).
- **Effect:** When a change occurs (even from a different device), the listener calls `router.refresh()`, updating the current view automatically.

### 2. Realtime Event Delivery
The `NotificationsProvider` acts as a global event bus. It converts database `INSERT` events in the `notifications` table into immediate, interactive UI toasts.

---

## Part 3: State Persistence (localStorage)

For data that must survive a complete session end or a cross-domain redirect (like the Stripe flow), Questr uses browser `localStorage`.

### 1. The Onboarding Bridge
The `goal_text` is saved to `localStorage` before the user is redirected to Stripe. Upon return, the `/onboarding` page reads this key to resume the AI generation process, acting as a persistent "memory" across the third-party payment journey.

---

## Part 4: Technical Invariants

- **Component Encapsulation:** Functional pages (`shop`, `pet`) are split into a Server-side "Shell" (handling data fetching) and a Client-side "Core" (handling interaction), ensuring maximum performance and SEO.
- **Optimistic State:** Interactive components maintain local `useState` for immediate visual feedback, which is then reconciled with the server data after the `router.refresh()` cycle completes.
- **Prop Drilling vs. Context:** Props are preferred for data passing between related components (e.g., `ShopPage` -> `ShopClientPage` -> `ShopItemCard`), ensuring the data flow is explicit and easy to trace.
