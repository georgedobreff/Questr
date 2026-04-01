# Auth, Onboarding & Profiles

This document provides a comprehensive, code-level breakdown of how Questr manages user identity, initial setup (Onboarding), and persistent metadata (Profiles).

---

## Part 1: The Profile Data Model

The `profiles` table is the most important metadata table in the application. It extends the internal Supabase `auth.users` table with game-specific data.

### `profiles` table

| Column | Type | Description |
|:---|:---|:---|
| `id` | `uuid` | **Primary Key.** Links directly to `auth.users.id`. |
| `full_name` | `text` | The user's real name or chosen handle. |
| `age` | `integer` | User's age, collected for context. |
| `coins` | `integer` | The primary in-game currency. |
| `xp` | `integer` | Experience points. |
| `level` | `integer` | Calculated player level. |
| `character_model_path` | `text` | Path to the user's active 3D avatar model. |
| `onboarding_completed` | `boolean` | Flag to track if the user has finished the first-time setup. |
| `dungeon_keys` | `integer` | Number of keys available for dungeon entry. |
| `action_points` | `integer` | Current regenerating energy for actions. |
| `has_had_trial` | `boolean` | Tracks if the user has already used their 10-day Pro trial. |

### Automatic Initialization
Questr uses a PostgreSQL **Trigger** to ensure every user has a profile record immediately upon signup.
- **Function:** `handle_new_user()`
- **Trigger:** `on_auth_user_created` (fired `AFTER INSERT` on `auth.users`).
- **Result:** A new row is inserted into `profiles` with the matching `id`, ensuring data integrity.

---

## Part 2: Authentication Flow

The `src/app/login/page.tsx` component is the entry point for all users.

### 1. Multi-Provider Support
- **Email/Password:** Standard credentials.
- **OAuth:** Direct integration with Google and Github.
- **Security:** Signups are protected by **Cloudflare Turnstile** (CAPTCHA) to prevent bot accounts.

### 2. Session Awareness & Redirection
The login page is highly proactive. In its `useEffect` hook:
- It checks for an existing session.
- **New Users:** If `onboarding_completed` is `false`, it uses `router.replace("/onboarding")` to force the setup flow.
- **Returning Users:** If onboarding is done, it redirects to the main quest `/log`.

---

## Part 3: The Onboarding Wizard

The `/onboarding` page is a multi-step, stateful experience designed to create a "Hero" identity.

### Steps:
1.  **Name:** Collection of `full_name`.
2.  **Character Selection:** Users cycle through 18 available Kenney models (`character-a` through `character-r`). These are previewed in 3D using the `CharacterViewer` component.
3.  **Age:** Collection of `age`.
4.  **The Goal:** The user defines their "Legend" (e.g., "Learn Python").
5.  **The Gate:** The user is presented with the Pro plan details.
    - **Logic:** Clicking the button saves the `goal_text` to `localStorage` and redirects the user to Stripe.
    - **Resumption:** When the user returns from Stripe, the page detects the `localStorage` key and triggers the AI plan generation.

---

## Part 4: Profile Management & Sanitization

While users can update their profiles directly via the Supabase client (governed by RLS), the app also uses the `update-user-profile` Edge Function for a cleaner, server-side interface.

### `update-user-profile` Edge Function
- **Sanitization:** It explicitly truncates names to 100 characters and validates the age range (13-120).
- **Security:** It verifies the user's JWT before performing the update, ensuring that a user can only ever modify their own record.

---

## Part 5: Security (RLS)

Security is managed at the database level:
- **`SELECT`:** `auth.uid() = id`. A user can only see their own profile.
- **`UPDATE`:** `auth.uid() = id`. A user can only update their own profile.
- **`INSERT`:** Blocked for standard users. Profiles are created exclusively by the `SECURITY DEFINER` trigger.
- **DELETE:** Cascades from `auth.users`. If a user deletes their account (via the `delete-user-account` function), their profile is automatically removed.

---

## Part 6: OAuth & Deep-Linking Strategy

The `/api/auth/callback` route handler is the silent orchestrator for OAuth (Google/Github) and deep-linked sessions.

### 1. The Code Exchange
When a user returns from an external provider, they bring a temporary `code`.
- **Logic:** The handler calls `supabase.auth.exchangeCodeForSession(code)` on the server.
- **Benefit:** This ensures the sensitive session tokens are handled securely in a server-side environment before being persisted to the user's browser cookies.

### 2. Onboarding-First Redirect Policy
The handler implements a strict routing priority to ensure data integrity:
1.  **Identity Check:** It verifies the session was created.
2.  **Onboarding Verification:** It queries the `profiles` table for `onboarding_completed`.
3.  **setup Force:** If `false`, it overrides any requested destination and forces a redirect to `/onboarding`.
4.  **Deep-Link Preservation:** If onboarding is done, it parses the `next` parameter. If `next` points to the root (`/`), it defaults to `/log`. Otherwise, it respects the user's target (e.g., returning from a password reset or a shared notification link).
