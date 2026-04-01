# AI Interactivity (Oracle & Adventure DM)

This document provides a comprehensive, code-level breakdown of the interactive AI systems in Questr. It explains how "The Oracle" provides guidance and how the "Adventure DM" runs the text-based RPG dungeon.

---

## Part 1: The Oracle (AI Mentor)

The Oracle is a persistent AI mentor available to Pro users. It provides context-aware advice, motivation, and support based on the user's specific goals and progress.

### Logic Flow (`oracle-chat` Edge Function)

1.  **Authentication & Gating:**
    - Validates the user's session.
    - **Pro Gating:** Checks the `subscriptions` table. Only users with `active`, `trialing`, or `pro` status can consult the Oracle.
2.  **Rate Limiting:**
    - **Spam Protection:** A 3-second cooldown between messages per user.
    - **Hourly Quota:** Users are limited to 50 messages per hour.
    - Tracks `last_oracle_chat_at`, `oracle_messages_count`, and `oracle_messages_period_start` in the `profiles` table.
3.  **Context Building:**
    - Fetches the user's **Active Plan** (`plans`) including all quests and tasks.
    - **Progress Analysis:** It identifies the user's current "active chapter" by finding the first module that has incomplete tasks.
    - Fetches the last 50 messages from the `chat_history` table for conversation continuity.
    - Summarizes the goal and current focus into a `{CONTEXT}` string.
4.  **AI Invocation (`ORACLE_PROMPT`):**
    - The prompt instructs the AI to be "wise, helpful, concise, and supportive."
    - It provides the user's name, the plan context, and the recent history.
    - **Streaming:** It uses `streamGemini` to return chunks of text to the client in real-time for a responsive UX.
5.  **Persistence:**
    - Once the stream is complete, the full AI response is saved back to the `chat_history` table.

---

## Part 2: The Adventure DM (Dungeon Master)

The Adventure DM is a complex AI system that generates and runs a full-featured text-based RPG. It behaves like a traditional Dungeon Master, managing state, items, and dice rolls.

### 1. Dungeon Generation (`action: 'start'`)

When a user enters a dungeon, the DM first generates a complete scenario.

- **Resource Consumption:** It calls the `enter_dungeon` RPC to securely deduct 12 AP and 1 Dungeon Key.
- **Generation Logic (`DUNGEON_GENERATOR_PROMPT`):**
    - The prompt uses the user's **Learning Goal** and **Plan Plot** as the thematic basis for the dungeon.
    - The AI generates a structured JSON object containing:
        - `theme` and `opening_scene`.
        - `win_condition` and a specific `reward` (item with stats).
        - `locations`, `enemies`, and `puzzles`.
        - `dungeon_items`: A list of loot, consumable, and puzzle items, each linked to a specific enemy or location (`source_id`).
- **Persistence:** The entire dungeon structure is saved to the `adventure_states` table. This ensures the dungeon is persistent and consistent across sessions.

### 2. Gameplay Loop (`action: 'continue'`)

Once in a dungeon, the user interacts with the DM via text messages.

- **State Loading:** The DM loads the `adventure_states` record and the last 10 messages from `adventure_chat_history`.
- **Logic Logic (`ADVENTURE_PROMPT`):**
    - The prompt gives the AI the role of a "Dungeon Master" with strict rules.
    - **No User Agency:** The AI is forbidden from describing the user's actions or thoughts.
    - **Dice Rolls:** Almost every user action (except simple movement) requires a roll. The AI decides the `stat` (e.g., Strength, Intellect) and the `dc` (Difficulty Class).
    - **Item Management:** The AI tracks `items_found` and `items_consumed`. If the user defeats an enemy, the AI must explicitly return the linked items in the `items_found` array.
- **Roll Resolution:**
    - If the user sends a message like "Rolled a 15", the DM compares it against the `dc` of the previous turn's requested action and narratively resolves the outcome (Success or Failure).
- **Victory & Rewards:**
    - If the AI returns `status: 'VICTORY'`:
        - It calls the `add_rewards` RPC to grant 100-200 Gold.
        - It programmatically creates the "Reward" item in the `shop_items` table (with a custom icon) and adds it to the user's permanent inventory.
        - It deletes the `adventure_states` record and sends a "Dungeon Cleared!" notification.

---

## Part 3: Prompts & Personality

The behavior of all AI features is governed by the prompts in `supabase/functions/_shared/prompts.ts`.

- **`CONTENT_MODERATION_PROMPT`:** A specialized prompt for safety. Note: The current version is set to be extremely permissive for this specific application.
- **`PLAN_GENERATOR_PROMPT`:** Instructs the AI to act as a "Dean" with "uncompromising standards," creating a professional-grade curriculum.
- **`BOSS_FIGHT_GENERATOR_PROMPT`:** Instructs the AI to act as a "Dungeon Master" and generate a challenging, module-specific quiz.
- **`KEYWORD_GENERATOR_PROMPT`:** A utility prompt that distills item descriptions into keywords for icon mapping.

---

## Part 4: Technical Invariants

- **JSON Output:** All AI functions (except Oracle chat) require the AI to return a specific, valid JSON object. This is enforced by strict prompts and handled by the `callGemini(..., true)` helper in `_shared/llm.ts`.
- **System Role:** The AI is always given a specific persona (Dean, Oracle, DM) to ensure a consistent tone and immersive experience.
- **Context injection:** The Edge Functions are responsible for fetching all necessary user data (stats, inventory, current plan) and injecting it into the prompt. The AI itself is "stateless" and relies entirely on the provided context.
