# Routing & Layouts

This document provides a comprehensive, code-level breakdown of the global architecture of the Questr application, focusing on its layout orchestration and route protection strategy.

---

## Part 1: Global Orchestration (`RootLayout`)

The `src/app/layout.tsx` is the entry point for the entire application. It sets up the critical providers and global styles.

### Key Components:
- **`ThemeProvider`:** Manages light/dark mode state using `next-themes`.
- **`PWAProvider`:** Handles Progressive Web App logic (offline support, installation).
- **`NotificationsProvider`:** The realtime engine that listens for new database records and triggers global toasts.
- **`ScenePreloader`:** Ensures 3D assets are cached and ready before they are needed in the UI.
- **`Toaster`:** The visual container for notifications.
- **`ActivityTracker`:** Likely monitors user interaction for session management or analytics.

---

## Part 2: Protected Application Space (`AppLayout`)

Questr uses a **Route Group** `(app)` to apply a consistent authenticated layout to all functional pages (`/log`, `/path`, `/pet`, etc.) while excluding public pages like `/login`.

### `(app)/layout.tsx` Structure:
1.  **`Navbar`:** The persistent navigation bar.
2.  **`SubscriptionGuard`:** The security gatekeeper.
3.  **Content Area:** An `overflow-hidden` container that ensures the app behaves like a native mobile application (fixed headers/tabs with a scrolling center).

---

## Part 3: The Subscription Guard

The `SubscriptionGuard.tsx` component is a critical business logic component that enforces Pro gating across the entire functional application.

### Logic Flow:
1.  **Authentication:** It first ensures a user is logged in.
2.  **Data Fetching:** It fetches the user's `subscriptions.status`, `profiles.has_had_trial`, and their pet's `nickname` in parallel.
3.  **Validation:**
    - If the user is **NOT** Pro (`active`, `trialing`, or `pro`) AND they have **already used** their trial (`has_had_trial = true`).
4.  **Enforcement:**
    - It opens an inescapable `Dialog` (modal).
    - **No Escape:** It explicitly blocks closing via clicking outside or pressing Escape (`onPointerDownOutside`, `onEscapeKeyDown`).
    - **Action:** The only available action is the "Continue Journey" button, which triggers the Stripe payment flow via the `handleGoPro` hook.

---

## Part 4: Responsive Navigation (`Navbar`)

The `Navbar.tsx` component is a dual-mode navigation system.

### Desktop Mode:
- **Top Bar:** Fixed at the top (`h-16`).
- **Primary Nav:** Horizontal list of text links with icons.
- **Secondary Nav:** Streak counter, Pro upgrade button (if applicable), Notification bell, Theme toggle, and Settings dropdown.

### Mobile Mode:
- **Bottom Bar:** Fixed at the bottom (`h-20`). Contains the 5 most important links as large icons.
- **"More" Menu:** A slide-up menu for secondary items (Merchant, Character, Settings).
- **Sub-Centering:** The mobile top bar uses a 3-column layout to perfectly center the logo while keeping the streak and notifications on the sides.

---

## Part 5: Routing Conventions

- **Landing Page:** `src/app/page.tsx` (Public).
- **Auth Flow:** `src/app/login/page.tsx` and `src/app/onboarding/page.tsx`.
- **Application Flow:** All routes inside `src/app/(app)/`.
- **API Space:** `src/app/api/` for webhook handlers and internal route handlers.
- **Legal Space:** `src/app/legal/` for Terms and Privacy.
