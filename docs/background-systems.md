# Background & Maintenance Systems

This document provides a comprehensive, code-level breakdown of the automated and semi-automated systems that manage the Questr game world, pet state, and subscription health.

---

## Part 1: The Pet Mission Lifecycle

Pet Missions provide passive rewards and progression. The lifecycle is managed by the `pet-mission-manager` Supabase Edge Function.

### 1. `action: 'start'` (Initiation)
- **Gating:** Checks that the pet is alive, not already on a mission, and has reached the level required for the difficulty (`medium: Level 5`, `hard: Level 10`).
- **Resource Check:** Consumes energy using the `spend_pet_energy` RPC (`easy: 50`, `medium: 70`, `hard: 100`).
- **Narrative Generation:** Uses **Gemini 2.5 Flash Lite** to generate a unique mission title and story plot tailored to the pet's name and type.
- **Persistence:** Creates a record in `pet_missions` with a calculated `duration_seconds`.

### 2. `action: 'resolve'` (Outcome)
- **Success Chance:** Calculated using a progressive formula:
    - **Easy:** 70% to 95% based on Level (1-15).
    - **Medium:** 55% to 90%.
    - **Hard:** 40% to 80%.
- **Loot Generation:**
    - If successful, it fetches the `pet_items` catalog.
    - It filters items by the pet's species (or universal items).
    - It randomly selects items based on difficulty (e.g., Hard missions can award multiple items and rare Energy Potions).
- **Automation:** The mission status is updated to `completed` or `failed`. A database trigger (`tr_pet_mission_notifications`) then automatically sends a notification to the user.

### 3. `action: 'claim'` (Rewards)
- **Experience:** Increases the pet's XP. If XP exceeds the threshold (`level * level * 100`), the pet levels up.
- **Gold:** Grants the randomized gold reward via the `increment_profile_coins` RPC.
- **Inventory:** Iterates through awarded items and calls `purchase_pet_item_internal` to add them to the user's pet inventory.
- **Energy Sync:** Calls `sync_pet_energy` to unfreeze the pet's energy regeneration.

---

## Part 2: Energy Heartbeat & Persistence

Questr uses a "lazy heartbeat" pattern to manage regenerating resources without requiring expensive periodic jobs for every user.

### `heartbeat_pet_energy(p_pet_id)` RPC
This function is called by the frontend whenever the pet UI is mounted.
- **Logical Flow:**
    1.  Calculates elapsed minutes since `last_energy_refill_at`.
    2.  **Frozen State:** If a mission is `ongoing`, it returns the currently saved energy without regenerating.
    3.  **Calculation:** Applies the rate of **1% every 2.4 minutes** (100% in 4 hours).
    4.  **Persistence:** Unlike a pure getter, this function **updates** the `user_pets` table with the new total and resets the `last_energy_refill_at` to `now()`.
- **UX Benefit:** The user sees their energy increasing in real-time without the server having to process millions of passive updates.

---

## Part 3: Subscription Maintenance

### `check-trial-expiration` Edge Function
This function is designed to be triggered by an external cron job (e.g., Supabase's built-in cron or GitHub Actions).
- **Targeting:** It scans the `subscriptions` table for users whose `stripe_current_period_end` falls within a specific 1-hour window (exactly 24 to 25 hours from the current time) and whose status is `trialing`.
- **Proactive Notification:** For each matching user, it inserts an `alert` type notification: *"Your trial ends tomorrow. Upgrade to continue your journey."*
- **Conversion:** The notification includes an `action_link` designed to trigger the upgrade UI in the settings page.

---

## Part 4: System Reliability

- **Transactional Claims:** The `claim` action in the mission manager uses multiple RPC calls. If any step fails, the mission remains in the `completed` state, allowing the user to retry the claim and preventing loss of rewards.
- **Species-Specific Loot:** The reward engine ensures that a Chicken never returns with a "Meaty Bone," maintaining game immersion at the code level.
- **Admin Privileges:** These background functions use the Supabase `service_role` key, allowing them to perform the necessary cross-table updates (Profile, Inventory, Missions) that are normally restricted by RLS for standard users.
