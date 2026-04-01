# Database Schema Reference

This document serves as the comprehensive technical reference for the Questr PostgreSQL database (managed via Supabase). It details every table, column, constraint, and security policy.

---

## 1. Domain: Identity & Profiles

These tables store user identity metadata and the global state of their "Hero."

### `public.profiles`
The primary extension of the Supabase `auth.users` table.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `uuid` | NO | | **PK**. References `auth.users.id`. |
| `full_name` | `text` | YES | | The user's chosen display name. |
| `age` | `integer` | YES | | User's age (collected during onboarding). |
| `coins` | `integer` | NO | `0` | Primary currency. |
| `xp` | `integer` | NO | `0` | Experience points for leveling. |
| `level` | `integer` | NO | `1` | Player's current level. |
| `character_model_path` | `text` | YES | | Path to the active 3D character model. |
| `onboarding_completed` | `boolean` | NO | `false` | Tracks first-time user setup status. |
| `timezone` | `text` | NO | `'UTC'` | User's local timezone for streak logic. |
| `last_login_at` | `timestamptz` | YES | `now()` | Last time `update_activity` was called. |
| `current_streak` | `integer` | NO | `0` | Consecutive days active. |
| `longest_streak` | `integer` | NO | `0` | All-time streak record. |
| `dungeon_keys` | `integer` | NO | `0` | Consumable currency for dungeon entry. |
| `action_points` | `integer` | NO | `0` | Regenerating energy for actions. |
| `has_had_trial` | `boolean` | NO | `false` | Anti-fraud flag for free trial usage. |
| `plan_generations_count` | `integer` | NO | `0` | Number of AI plans generated in current period. |
| `plan_generations_period_start`| `timestamptz`| NO | `now()` | Start of the weekly rate-limit period. |
| `purchased_plan_credits` | `integer` | NO | `0` | Extra plan generations bought by user. |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Constraints:**
- `profiles_pkey`: Primary Key on `id`.
- `profiles_id_fkey`: Foreign Key to `auth.users(id)` ON DELETE CASCADE.

**Policies (RLS):**
- `Users can view their own profile.`: `auth.uid() = id`.
- `Users can update their own profile.`: `auth.uid() = id`.

**Indexes:**
- `idx_profiles_xp`: `xp DESC`.
- `idx_profiles_current_streak`: `current_streak DESC`.

---

## 2. Domain: The Learning Journey (Plans & Quests)

These tables store the AI-generated curricula and their progression state.

### `public.plans`
The master record for a user's "Legend."

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. Identity generated. |
| `user_id` | `uuid` | NO | | **FK**. References `auth.users.id`. |
| `goal_text` | `text` | NO | | The goal string provided to the AI. |
| `plot` | `text` | YES | | AI-generated fantasy prologue. |
| `total_estimated_modules` | `integer` | YES | | Number of modules in the plan. |
| `total_estimated_duration_weeks`| `integer` | YES | | Duration calculated by the AI. |
| `complexity` | `text` | NO | `'pro'` | Gating tier for the plan. |
| `plan_details` | `jsonb` | YES | | **Full AI Output Blob**. Master JSON record. |
| `is_reward_claimed` | `boolean` | NO | `false` | If completion rewards were granted. |
| `created_at` | `timestamptz` | NO | `now()` | |

**Constraints:**
- `plans_pkey`: Primary Key on `id`.
- `plans_user_id_fkey`: Foreign Key to `auth.users(id)` ON DELETE CASCADE.

---

### `public.quests`
Daily chapters within a module.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. Identity generated. |
| `plan_id` | `bigint` | NO | | **FK**. References `public.plans.id`. |
| `title` | `text` | YES | | Name of the daily quest. |
| `story` | `text` | YES | | AI-generated fantasy flavor text. |
| `status` | `text` | NO | `'pending'` | `pending` or `completed`. |
| `module_number` | `integer` | NO | | The module/week this quest belongs to. |
| `day_number` | `integer` | NO | | The day (1-7) within the module. |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:**
- `idx_quests_plan_id`: Index on `plan_id`.

---

### `public.tasks`
Actionable items within a daily quest.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. Identity generated. |
| `quest_id` | `bigint` | NO | | **FK**. References `public.quests.id`. |
| `title` | `text` | NO | | The task name. |
| `short_description` | `text` | YES | | AI-generated specific instruction. |
| `reward_coins` | `integer` | NO | `5` | Gold awarded upon checking. |
| `is_completed` | `boolean` | NO | `false` | |
| `completed_at` | `timestamptz` | YES | | Timestamp of completion. |
| `is_rewarded` | `boolean` | NO | `false` | If coins/XP were added to profile. |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:**
- `idx_tasks_quest_id`: Index on `quest_id`.

---

## 3. Domain: Economy & Inventory

### `public.shop_items`
Master catalog of Player gear and consumables.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. Identity generated. |
| `plan_id` | `bigint` | YES | | **FK**. Link to specific Legend (if themed). |
| `name` | `text` | NO | | Item name (Unique). |
| `description` | `text` | YES | | |
| `cost` | `integer` | NO | `0` | |
| `asset_url` | `text` | YES | | Filename of the icon. |
| `type` | `text` | NO | `'equippable'`| `equippable` or `consumable`. |
| `slot` | `text` | NO | `'misc'` | `head`, `torso`, `weapon`, etc. |
| `stat_buffs` | `jsonb` | YES | | JSON object: `{"StatName": integer}`. |
| `source` | `text` | NO | `'shop'` | `shop`, `reward`, `dungeon_reward`. |

---

### `public.user_items`
Player's collection of gear.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. Identity generated. |
| `user_id` | `uuid` | NO | | **FK**. References `auth.users.id`. |
| `item_id` | `bigint` | NO | | **FK**. References `public.shop_items.id`. |
| `acquired_at` | `timestamptz` | NO | `now()` | |

---

### `public.equipped_items`
Currently active gear slots.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. Identity generated. |
| `user_id` | `uuid` | NO | | **FK**. References `auth.users.id`. |
| `item_id` | `bigint` | NO | | **FK**. References `public.shop_items.id`. |
| `slot` | `text` | NO | | The gear slot being occupied. |

**Constraints:**
- `unique_user_slot`: UNIQUE on `(user_id, slot)`. Enforces one item per slot.

---

## 4. Domain: Pet System

### `public.user_pets`
User's companions.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `uuid` | NO | `gen_random_uuid()`| **PK**. |
| `user_id` | `uuid` | NO | | **FK**. References `auth.users.id`. |
| `pet_def_id` | `text` | NO | | **FK**. References `pet_definitions.id`. |
| `nickname` | `text` | YES | | |
| `health` | `integer` | NO | `100` | |
| `happiness` | `integer` | NO | `100` | |
| `status` | `text` | NO | `'alive'` | `alive` or `dead`. |
| `level` | `integer` | NO | `1` | |
| `xp` | `integer` | NO | `0` | |
| `current_energy` | `integer` | NO | `100` | |
| `last_energy_refill_at` | `timestamptz`| NO | `now()` | |
| `last_fed_at` | `timestamptz`| YES | `now()` | |
| `revival_progress` | `integer` | NO | `0` | Module count at death baseline. |

---

## 5. Domain: Challenge Systems (Dungeons & Bosses)

### `public.boss_fights`
Quiz-combat instances.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `uuid` | NO | | **PK**. |
| `user_id` | `uuid` | NO | | **FK**. References `profiles.id`. |
| `plan_id` | `bigint` | NO | | **FK**. References `plans.id`. |
| `module_number` | `integer` | NO | | |
| `boss_type` | `text` | NO | | e.g., "Wizard". |
| `boss_model_path` | `text` | NO | | |
| `questions` | `jsonb` | NO | `'[]'` | The AI-generated quiz questions. |
| `player_hp` | `integer` | NO | `100` | |
| `boss_hp` | `integer` | NO | `100` | |
| `status` | `text` | NO | `'active'` | `active`, `defeated`, `failed`. |
| `explanation` | `text` | YES | | AI tutoring for mistakes. |
| `cooldown_until` | `timestamptz`| YES | | |

---

## 6. Domain: System & Auditing

### `public.subscriptions`
Stripe relationship data.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `uuid` | NO | | **PK**. |
| `user_id` | `uuid` | NO | | **FK**. References `auth.users.id`. |
| `status` | `text` | NO | `'free'` | `free`, `active`, `trialing`, etc. |
| `stripe_customer_id` | `text` | YES | | |
| `stripe_subscription_id`| `text` | YES | | |
| `stripe_price_id` | `text` | YES | | |
| `stripe_current_period_end`| `timestamptz`| YES | | |

### `public.notifications`
Realtime alerts.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. |
| `user_id` | `uuid` | NO | | **FK**. References `auth.users.id`. |
| `title` | `text` | NO | | |
| `message` | `text` | NO | | |
| `type` | `text` | NO | `'info'` | |
| `is_read` | `boolean` | NO | `false` | |
| `action_link` | `text` | YES | | |

### `public.processed_webhook_events`
Idempotency table for Stripe.

| Column | Type | Nullable | Default | Description |
|:---|:---|:---|:---|:---|
| `id` | `bigint` | NO | | **PK**. |
| `stripe_event_id` | `text` | NO | | Unique event ID from Stripe. |
| `processed_at` | `timestamptz`| NO | `now()` | |
