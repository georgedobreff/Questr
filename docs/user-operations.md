# User Operations & Session Management

This document provides a comprehensive, code-level breakdown of the "Glue" systems that manage user sessions, account health, and privacy compliance.

---

## Part 1: High-Integrity Account Deletion

The `delete-user-account` Edge Function is a mission-critical utility that ensures a clean exit for users, preventing orphaned data or lingering financial obligations.

### Logic Flow:
1.  **Subscription Cancellation:** It first checks for an active Stripe subscription. If found, it calls the Stripe API to **instantly cancel** the subscription to prevent future billing.
2.  **Manual Data Wipe:** While the database uses `ON DELETE CASCADE`, this function performs manual deletions from the following tables as an explicit safeguard:
    - `user_stats`, `chat_history`, `adventure_chat_history`, `equipped_items`, `user_items`, `plans`, `subscriptions`, `processed_webhook_events`.
3.  **Identity Removal:** Finally, it calls the Supabase Admin API (`auth.admin.deleteUser`) to remove the user's primary credentials.
- **Security:** This function requires a valid JWT from the user and then uses the `service_role` key to perform administrative cleanup.

---

## Part 2: Global Session Handlers

Questr uses headless components rendered at the root level to respond to authentication events globally.

### 1. Password Recovery (`PasswordRecoveryHandler.tsx`)
- **Event-Driven:** It subscribes to Supabase's `onAuthStateChange`.
- **Logic:** When the browser receives a `PASSWORD_RECOVERY` event (triggered by clicking a link in a reset email), this component automatically renders a secure `Dialog` for the user to set a new password.
- **Benefit:** Eliminates the need for a dedicated "Reset Password" page and ensures the UI is consistent regardless of where the user is in the app.

### 2. Activity & Timezone Tracking (`ActivityTracker.tsx`)
- **Purpose:** Foundation for the streak and mission systems.
- **Logic:**
    - On mount and on login, it detects the user's local timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
    - It calls the `update_activity` RPC, passing the timezone string.
- **Persistence:** This ensures the backend always knows the user's current local time, which is critical for awarding daily streaks correctly.

---

## Part 3: Privacy & Legal Compliance

Questr includes a dedicated route group for legal documentation under `/legal`.

- **Structure:** `privacy-policy`, `terms-of-service`, `refund-policy`, `cookie-policy`, and `spaghetti-policy`.
- **Layout:** All legal pages share a common `legal/layout.tsx` which provides a clean, text-focused reading environment.
- **Cookie Consent:** The `CookieBanner.tsx` component (rendered in `RootLayout`) manages user consent for tracking and analytics, satisfying GDPR and CCPA requirements.

---

## Part 4: Security Invariants

- **Admin Safeguards:** The account deletion function is "fail-safe"—it logs errors for individual table deletions but continues the process to ensure the primary goal (stopping billing and removing the user) is met.
- **JWT Verification:** All user-level operations in Edge Functions verify the JWT against the Supabase Auth service before proceeding, preventing cross-user data manipulation.
- **Headless pattern:** By using headless components for session management, the app keeps the core business logic decoupled from the visual page components.
