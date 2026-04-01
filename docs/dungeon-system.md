# The Dungeon & Combat System

This document provides a comprehensive, code-level breakdown of the Dungeon and Boss Fight systems in Questr. These systems represent the primary challenge-based content in the game.

## Part 1: Core Concepts & Resources

### Dungeon vs. Boss Fight

- **Dungeons (`adventure_states`):** A multi-stage event where a player progresses through a narrative or a series of challenges. A player's state (current room, health, items found) is persistent until the run is completed or failed. It is initiated by spending specific resources.
- **Boss Fights (`boss_fights`):** A single, climatic encounter that serves as a "test" at the end of a learning module within a Plan. The combat mechanic is not traditional turn-based fighting, but is instead **quiz-based**.

### Core Resources

This system is gated by two main resources stored on the `profiles` table:

- **Dungeon Keys:** A consumable item required to start a new dungeon run. The `dungeon_keys` column on the `profiles` table tracks how many a user has. They can be granted via the `add_dungeon_keys` function.
- **Action Points (AP):** A regenerating resource that is also spent to enter a dungeon. A dungeon run costs 12 AP.

## Part 2: The Boss Fight (Quiz Combat) System

The Boss Fight is a unique take on combat that tests the user's knowledge on the module they just completed.

### Data Model: `boss_fights`

This table holds the state for a specific boss encounter, which is uniquely tied to a user and a specific module within their plan.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key.** |
| `user_id` | `uuid` | **Foreign Key** to `profiles(id)`. The user in the fight. |
| `plan_id` | `bigint` | **Foreign Key** to `plans(id)`. The learning plan this boss fight belongs to. |
| `module_number`| `int` | The specific module number within the plan that this boss concludes. |
| `boss_type` | `text` | The class of the boss (e.g., "Wizard"). |
| `boss_model_path`| `text` | Path to the 3D model in `public/enemies/`. |
| `story_plot` | `text` | AI-generated flavor text setting the scene for the fight. |
| `explanation`| `text` | AI-generated narrative describing the boss's appearance and the start of the fight. |
| `questions` | `jsonb` | **The core mechanic.** A JSON array of quiz questions. Each object in the array contains: `question` (text), `options` (array of text), and `correct_index` (integer). |
| `player_hp` | `integer` | The player's health for this fight (starts at 100). |
| `boss_hp` | `integer` | The boss's health for this fight (starts at 100). |
| `status` | `boss_fight_status`| `ENUM` type ('active', 'defeated', 'failed'). |
| `cooldown_until` | `timestamptz`| A timestamp indicating when the user can retry the fight if they fail. |

**Constraint:** There is a `UNIQUE` constraint on `(user_id, plan_id, module_number)` to ensure only one boss fight can exist for each learning module per user.

### Backend Logic: `generate-boss-quiz` Edge Function

The quiz content is not static; it's created on-demand by a Supabase Edge Function named `generate-boss-quiz`.

**Inferred Logic Flow:**
1.  The function is invoked with a `planId` and `moduleNumber`.
2.  It retrieves the content and topics associated with that specific module of the user's learning plan from the database.
3.  It constructs a prompt for the Google Gemini AI, providing the module's content and requesting that the AI generate a series of multiple-choice questions relevant to the topic. The prompt also specifies the required JSON output format for the `questions` array.
4.  It calls the Gemini API and parses the response.
5.  It saves the AI-generated questions, story, and other details into the corresponding `boss_fights` table record for the user.
6.  It returns the complete boss fight data to the client.

This function is called pre-emptively when a user is close to finishing a module (e.g., in `task-item.tsx`) and also when the user explicitly clicks the "Start Boss Fight" trigger, ensuring the quiz is ready when needed.

## Part 3: The Dungeon Run System

This system is for longer-form, exploratory challenges.

### Data Model: `adventure_states`

This is the primary table for tracking a user's progress through a dungeon.

| Column | Type | Description |
| :--- | :--- | :--- |
| `user_id` | `uuid` | The user on the adventure. This column has a `UNIQUE` partial index `WHERE is_active = true`, enforcing a single active run per user. |
| `is_active` | `boolean`| A flag indicating if the run is currently in progress. |
| `dungeon_items`| `jsonb` | A JSON array holding items the user has collected *inside* the dungeon. This is a temporary inventory for the run. |
| ...and more | | Based on the table name, it's expected to also contain fields for `current_dungeon_id`, `current_hp`, and other state. |

### Backend Logic: `enter_dungeon(p_user_id)`

This `SECURITY DEFINER` function is the secure gateway to starting a dungeon run.

**Logic Flow:**
1.  **Subscription Check:** Verifies the user has an `active` or `trialing` subscription.
2.  **Resource Check:** Retrieves the user's `action_points` and `dungeon_keys` from their `profiles` table.
3.  **Validation:** Checks if `action_points >= 12` AND `dungeon_keys >= 1`.
4.  **On Success:** It `UPDATE`s the user's profile, subtracting the resources. This is a single, atomic transaction.
5.  **On Failure:** It returns an error specifying which resource is missing.

## Part 4: Frontend Integration

### Boss Fight Flow

The user journey for a boss fight is orchestrated across several components:

1.  **Trigger (`src/app/(app)/log/page.tsx` & `src/components/boss-fight-trigger.tsx`):**
    - The main `log` page, which displays the user's quest plan, fetches the status of the boss fight for the current module.
    - If a boss fight is ready, it renders the `BossFightTrigger` component.
    - Clicking this component's button ("Start Boss Fight") calls the `generate-boss-quiz` Edge Function to ensure the latest data is available, and then opens the main fight dialog.

2.  **The Arena (`src/components/boss-fight-dialog.tsx`):**
    - This component is the brain of the operation. It opens a full-screen dialog for the fight.
    - It manages the state of the entire encounter: player HP, boss HP, the current question, and user answers.
    - It renders the `BossArena` component to display the visuals.
    - As the user answers questions, this component determines correctness and calculates the new HP values for both player and boss. It then updates its local state and triggers animations.
    - Once the quiz is over, this component calls `supabase.from('boss_fights').update(...)` to save the final state (status, HP) to the database.

3.  **Visuals (`src/components/boss-arena.tsx`):**
    - This is a presentational component focused on the 3D scene.
    - It receives the player and boss models, their current HP, and animation names (e.g., 'Idle', 'Attack', 'Death') as props.
    - It renders the 3D characters and the HP bars, playing animations as directed by its parent, `BossFightDialog`.

4.  **Map & Feedback (`src/components/procedural-map.tsx`):**
    - This component displays the user's entire learning journey as a series of nodes.
    - Boss fights are represented as special "boss" nodes on this map.
    - After a fight, this component can also display a `BossFeedbackCard` containing the AI-generated `explanation` text.

### Dungeon Run Flow

**Status: UI Not Found**

As of this writing, no frontend component has been found that calls the `enter_dungeon` RPC function. While the backend logic and resources (Dungeon Keys, Action Points) are fully implemented, the user interface for browsing and starting a dungeon run appears to be unimplemented.

## Part 5: Security & Asset Conventions

### Security
- **Server-Side Logic:** All state changes are handled by secure backend functions. The client is only responsible for displaying state and sending user actions. This prevents cheating.
- **`SECURITY DEFINER`:** Functions like `enter_dungeon` use this to safely consume resources from the user's `profiles` table.
- **RLS Policies:** All tables have Row-Level Security, ensuring a user can only interact with their own `boss_fights` and `adventure_states`.

### Asset Conventions
- **Enemy Models:** 3D models for bosses are stored in `public/enemies/`.
  - Example: `public/enemies/Wizard.gltf`
  - The model is referenced by the `boss_model_path` column in the `boss_fights` table.
