# Streaks & Timezones

This document provides a comprehensive, code-level breakdown of the daily engagement systems in Questr, specifically how the application calculates streaks and handles global timezones.

---

## Part 1: Timezone-Aware Logic

Managing "daily" actions in a global application is complex. Questr solves this by offloading date calculations to the database using the user's reported timezone.

### 1. Data Capture
The `ActivityTracker.tsx` component captures the user's browser timezone (e.g., `America/New_York`) and sends it to the backend via the `update_activity` RPC.

### 2. Date Conversion (SQL)
The `update_activity` function performs the following conversions to ensure accuracy:
- **UTC Baseline:** `v_now_utc timestamptz := now();`
- **Local Conversion:** `v_today_local date := date(v_now_utc AT TIME ZONE p_timezone);`
- **Comparison Baseline:** `v_last_login_local date := date(v_last_login AT TIME ZONE p_timezone);`

By converting to the `date` type *after* applying the timezone offset, the system accurately identifies "today" regardless of the user's location on Earth.

---

## Part 2: The Streak Engine

The streak engine is designed to reward consistency and penalize long absences.

### Logic States:
- **New/Reset:** If `current_streak` is 0 or the user missed a day, the streak is set to 1.
- **Maintenance:** If the user has already logged in "today" (local time), the function exits without changes. This allows the user to refresh the app multiple times without inflating their streak.
- **Increment:** If `v_last_login_local` is exactly `v_today_local - 1`, the `current_streak` is incremented.
- **Record Breaking:** If `current_streak` exceeds `longest_streak`, the latter is updated to match.

---

## Part 3: Integrated Game Loops

The activity update is not just about numbers; it drives the core "Living World" mechanics.

### 1. Pet Stat Decay
Whenever the streak logic detects a **New Day** (either an increment or a reset), it calls `decay_pet_stats(v_user_id)`.
- **Health:** -10
- **Happiness:** -5
- **Purpose:** This ensures that pet maintenance is a daily requirement, directly linked to the user's presence in the app.

### 2. Pet Healing
Inversely, the `add_rewards` function (called when a task is completed) calls `heal_pet_on_task(user_id_input)`.
- **Health:** +5
- **Happiness:** +2
- **Purpose:** This creates a positive feedback loop where completing real-world tasks directly improves the well-being of the user's digital companion.

---

## Part 4: Security & Integrity

- **Authoritative Source:** The `update_activity` function is a `SECURITY DEFINER` RPC. The client only provides the timezone name; the server determines the current time and performs the calculations.
- **Transactionality:** The timezone update, streak calculation, and pet decay all occur within a single database transaction.
- **Event Hooks:** The `update_activity` function also triggers the `check_achievements` RPC, ensuring that streak-based badges (e.g., "Determined - 3 day streak") are awarded the moment the criteria are met.
