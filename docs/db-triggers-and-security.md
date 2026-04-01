# Database Triggers & Integrity Constraints

This document provides an exhaustive, code-level analysis of the "Silent Sentinels" of the Questr database: the PostgreSQL triggers and integrity functions that enforce security, automate rewards, and maintain the game world's consistency.

---

## Part 1: Automated User Lifecycle

### 1. Profile Initialization (`handle_new_user`)
- **Trigger:** `on_auth_user_created` (fired `AFTER INSERT` on `auth.users`).
- **Function:** `public.handle_new_user()`.
- **Logic:**
    - Every time a new user signs up via Supabase Auth, this `SECURITY DEFINER` function automatically creates a matching record in the `public.profiles` table.
    - **Invariants:** Ensures that any authenticated user *always* has a game profile, preventing "ghost users" from breaking the frontend data fetches.

### 2. Subscription Reward Automation (`handle_subscription_key_awards`)
- **Trigger:** `on_subscription_reward` (fired `AFTER INSERT OR UPDATE` on `public.subscriptions`).
- **Function:** `public.handle_subscription_key_awards()`.
- **Logic:**
    - Monitors the `status` and `stripe_current_period_end` of user subscriptions.
    - **Trial Award:** Grants **1 Dungeon Key** when a user first starts a trial.
    - **Paid Award:** Grants **5 Dungeon Keys** when a user starts or renews a paid subscription.
    - **Integrity:** It uses `stripe_current_period_end` as a marker to detect billing renewals, ensuring rewards are granted exactly once per billing cycle.

---

## Part 2: Security & Anti-Cheat Enforcement

### 1. Task Reward Protection (`check_task_update_permissions`)
- **Trigger:** `protect_task_rewards` (fired `BEFORE UPDATE` on `public.tasks`).
- **Function:** `public.check_task_update_permissions()`.
- **Logic:**
    - This is a critical security gate. While the frontend can update `is_completed`, this trigger **blocks** any attempt to modify `reward_coins` or `title` from the client.
    - **Exception:** It explicitly verifies `NEW.reward_coins IS DISTINCT FROM OLD.reward_coins` and raises an exception if they differ.
    - **Outcome:** Prevents users from manually increasing the coin value of a task before marking it complete.

### 2. Equipment Integrity (`check_item_ownership`)
- **Trigger:** `verify_ownership_before_equip` (fired `BEFORE INSERT OR UPDATE` on `public.equipped_items`).
- **Function:** `public.check_item_ownership()`.
- **Logic:**
    - Verifies that the `item_id` being equipped actually exists in the user's `user_items` inventory.
    - **Outcome:** Prevents users from "force-equipping" powerful items they haven't actually bought or earned.

### 3. Profile Stat Protection (`check_profile_update_permissions`)
- **Trigger:** `protect_profile_stats` (fired `BEFORE UPDATE` on `public.profiles`).
- **Function:** `public.check_profile_update_permissions()`.
- **Logic:**
    - Explicitly monitors the sensitive progression columns: `coins`, `xp`, and `level`.
    - **Outcome:** Blocks any attempt by an `authenticated` user to manually update these values via the PostgREST API. This ensures that rewards only flow through the trusted `handle_task_rewards` trigger or `SECURITY DEFINER` RPCs.

---

## Part 3: Living World Simulation (Pets)

### 1. Automated Decay & Death (`decay_pet_stats`)
- **Integration:** This function is invoked by the `update_activity` RPC (see `deep-dive-streaks-and-timezones.md`).
- **Logic:**
    - Decrements `health` (-10) and `happiness` (-5).
    - **Death Transition:** If health drops to 0 or below, the pet's `status` is set to `dead`.
    - **Revival Baseline:** It captures a snapshot of the user's current completed module count in `revival_progress`. This acts as the starting line for the "Penance" required to revive the pet.

### 2. The Penance of Revival (`revive_pet`)
- **RPC Function:** `public.revive_pet(p_user_id)`.
- **Logic:**
    - To revive a pet, a user must complete **3 learning modules** from their plan while the pet is dead.
    - It calculates `current_modules - revival_progress`.
    - **Success:** If progress >= 3, the pet is restored to `alive` status with 50% health/happiness.
    - **Failure:** Returns a formatted progress string (e.g., `"progress:1/3"`) to the frontend for the user to see their penance status.

---

## Part 4: Technical Constraints & Set Path

### 1. `SECURITY DEFINER`
All triggers and functions in this document are created with `SECURITY DEFINER`.
- **Why?** They need to perform operations (like updating `profiles` or `user_pets`) that the authenticated user is blocked from doing directly by RLS. The function acts as a trusted, high-privilege proxy for specific, validated business logic.

### 2. Search Path Security
Most functions explicitly set `search_path = public`.
- **Why?** This prevents "Search Path Hijacking" where a malicious user could potentially create shadow tables in other schemas to trick these high-privilege functions into modifying the wrong data.

### 3. Cascading Integrity
Every foreign key in the database is configured with `ON DELETE CASCADE`.
- **Logic:** When a user is deleted (via `delete-user-account`), PostgreSQL's internal engine automatically clears all rows in `profiles`, `plans`, `quests`, `tasks`, `inventory`, etc.
- **Performance:** As documented in `deep-dive-db-performance.md`, these cascades are backed by B-tree indexes to ensure account deletion remains fast and efficient.
