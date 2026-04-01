# AI Plan Generation

This document provides a comprehensive, code-level breakdown of the core AI Plan Generation system. This is the central feature of Questr, responsible for converting a user's goal into a complete, gamified learning plan. The logic is orchestrated by the `plan-generator` Supabase Edge Function.

## Part 1: Data Models

The generated plan is stored across three main tables.

### `plans` table
This table holds the top-level information about a user's "Legend" or goal.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `bigint` | **Primary Key.** |
| `user_id` | `uuid` | **Foreign Key** to `auth.users(id)`. The owner of the plan. |
| `goal_text` | `text` | The user's stated goal, as interpreted by the AI. |
| `plot` | `text` | An AI-generated narrative or "flavor text" for the entire plan. |
| `total_estimated_modules` | `integer`| The total number of modules the AI has generated for the plan. |
| `total_estimated_duration_weeks`| `integer`| The total estimated duration to complete the plan. |
| `plan_details` | `jsonb` | **Crucial Field.** A JSONB column that stores the *entire, raw AI-generated plan object*. This serves as a master record, from which quests and tasks are populated "just-in-time". |

### `quests` table
This table holds the quests for a specific day within a module.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `bigint` | **Primary Key.** |
| `plan_id` | `bigint` | **Foreign Key** to `plans(id)`. Links the quest to a plan. |
| `title` | `text` | The name of the daily quest (e.g., "Day 1: Mastering the Basics"). |
| `story` | `text` | AI-generated flavor text for the day's quest. |
| `status` | `text` | The current status of the quest (e.g., 'pending', 'completed'). |
| `module_number`| `integer`| The module this quest belongs to. |
| `day_number` | `integer` | The day number within the module for this quest. |

### `tasks` table
This table holds the individual, actionable sub-tasks for a single quest.

| Column | Type | Description |
|:---|:---|:---|
| `id` | `bigint` | **Primary Key.** |
| `quest_id` | `bigint` | **Foreign Key** to `quests(id)`. Links the task to a daily quest. |
| `title` | `text` | The main title of the task. |
| `short_description` | `text` | A brief description of what the task entails. |
| `reward_coins`| `integer`| The amount of Gold awarded upon completion. |
| `is_completed` | `boolean` | `true` if the user has completed the task. |

## Part 2: The `plan-generator` Edge Function

This function is the orchestrator for the entire plan generation process. It is a complex, multi-step function that performs validation, calls the AI in parallel, and populates the database.

**Endpoint:** `POST /functions/v1/plan-generator`
**Body:** `{ "goal_text": string, "abandon_previous": boolean }`

### Step 1: Validation and Security
1.  **Authentication:** Checks for a valid user session.
2.  **Content Moderation:** Sends the `goal_text` to the Gemini AI with a `CONTENT_MODERATION_PROMPT`. If flagged, it terminates.
3.  **Subscription Check:** Ensures the user has an active "pro" subscription or trial.

### Step 2: Sophisticated Rate Limiting
A multi-layered system prevents abuse:
1.  **Weekly Limit:** A base of 3 generations per 7-day period.
2.  **Purchased Credits:** If the limit is exceeded, it consumes a `purchased_plan_credits` if available.
3.  **Debounce:** A 60-second cooldown (`last_plan_generated_at`) prevents spamming.

### Step 3: Parallel AI Chains
The function uses `Promise.all` to execute two main "chains" of AI calls concurrently.

**Chain A: The Core Plan**
- Makes a single, large call to Gemini with the `PLAN_GENERATOR_PROMPT` to create the entire structured learning plan (modules, quests, tasks).

**Chain B: The "Flavor" and Economy**
1.  **Generate Stats:** Calls Gemini with `STAT_GENERATOR_PROMPT` to create character stats relevant to the goal.
2.  **Generate Shop Items:** Feeds the goal and stats into `SHOP_ITEMS_GENERATOR_PROMPT` to create thematic items.
3.  **Generate Icons:** For each item, it makes another AI call with `KEYWORD_GENERATOR_PROMPT`, then uses the resulting keywords to intelligently select a matching icon from a local library (`iconTags`).

### Step 4: Database Population
1.  **Abandon Old Plan (Optional):** If `abandon_previous: true`, it performs a full cascade delete of the user's previous plan data.
2.  **Save New Plan:** `INSERT`s a row into `plans`, storing the entire raw AI response in the `plan_details` JSONB column.
3.  **Save Flavor:** `INSERT`s the generated stats and themed shop items.
4.  **Save Module 1 (Just-In-Time):** To optimize performance, it only parses and `INSERT`s the quests and tasks for the very first module. The rest of the plan is populated later as the user progresses.

## Part 3: Frontend Integration

The `plan-generator` function is invoked from two primary places, each with a distinct user flow.

### 1. New User Onboarding Flow

**Component:** `src/app/onboarding/page.tsx`

This component is a multi-step wizard for new users.

**User Flow & Logic:**
1.  **Profile Setup:** The user progresses through steps to enter their name, choose a 3D character model, and enter their age.
2.  **Goal Input:** The user enters their desired goal into a `<Textarea>`.
3.  **Trial/Subscription Gate:** The user is presented with a page detailing the benefits of a Pro plan and a button to "Start 10-Day Free Trial" or "Subscribe".
4.  **Payment Redirect:** When the user clicks the trial/subscribe button, the `goal_text` is saved to `localStorage`, and the user is redirected to Stripe via the `useGoPro` hook.
5.  **Return and Trigger:** When the user returns to the `/onboarding` page after the Stripe process, a `useEffect` hook detects the goal in `localStorage`. This triggers the `triggerGeneration` function.
6.  **Verification Loop:** `triggerGeneration` polls the `subscriptions` table for up to 40 seconds to confirm the subscription is active before proceeding. This handles webhook delays from the payment provider.
7.  **Invocation:** Once verified, it calls `supabase.functions.invoke('plan-generator', { body: { goal_text, abandon_previous: false } })`.
8.  **Resilient Polling:** If the function invocation times out, the page initiates another polling loop, this time checking the `plans` table for a newly created plan. This provides a resilient UX even if the serverless function takes a long time to respond.
9.  **Completion:** Upon success, `onboarding_completed` is set to `true` in the user's profile, and they are redirected to the main `/log` page.

### 2. Existing User "New Path" Flow

**Component:** `src/app/(app)/new-path/page.tsx`

This page allows existing "Pro" users to create a new plan.

**User Flow & Logic:**
1.  **Pro Check:** The page immediately checks for a valid subscription. If the user is not a Pro, it displays a "Forge Locked" message with a button to upgrade.
2.  **Goal Input:** The UI consists of a simple `<Textarea>` for the user to input their new goal.
3.  **Submission:** When the user submits the form, the `onSubmit` function is called.
4.  **Existing Plan Check:** The function first checks if the user already has a plan.
    - **If no plan exists,** it immediately invokes `plan-generator` with `abandon_previous: false`.
    - **If a plan exists,** it opens a confirmation dialog, warning the user that their current progress will be lost.
5.  **Confirmation:** If the user confirms, the function is invoked with `abandon_previous: true`.
6.  **Specific Error Handling:** This page includes specific dialog boxes for different failure modes, such as `429` (Rate Limit exceeded) and `400` (Content Moderation failure), providing more context to the user than a generic error toast. It also uses the same resilient timeout polling as the onboarding page.