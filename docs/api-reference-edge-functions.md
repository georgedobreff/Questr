# API Reference: Supabase Edge Functions

This document provides the technical specification for every Edge Function in the Questr project. These functions handle sensitive logic, AI orchestration, and third-party integrations.

---

## 1. Plan & Progression Management

### `abandon-active-plan`
Destructive operation to wipe a user's current game state.
- **Endpoint:** `POST /functions/v1/abandon-active-plan`
- **Body:** `{}` (Authentication via JWT)
- **Logic:**
    - Deletes all records in `tasks`, `user_stats`, `shop_items`, `quests`, and `plans` for the user.
    - Resets `profiles`: `coins: 0`, `xp: 0`, `level: 1`.
    - Clears `user_items`, `equipped_items`, `chat_history`, and `adventure_chat_history`.
- **Response:** `200 OK` with confirmation message.

### `check-module-completion`
Validates if a module is finished and triggers the next one.
- **Endpoint:** `POST /functions/v1/check-module-completion`
- **Body:** `{ "plan_id": number, "module_number": number }`
- **Logic:**
    - Checks for incomplete tasks in the specified module.
    - If complete:
        - Checks for final plan completion.
        - Verifies subscription status.
        - Invokes `continue-plan` if the next module doesn't exist.
- **Response:** `200 OK` with status message (e.g., `'PLAN_COMPLETED'`, `'Module completed. Next module generated.'`).

### `check-plan-completion`
Final validation for an entire learning journey.
- **Endpoint:** `POST /functions/v1/check-plan-completion`
- **Body:** `{ "task_id"?: number, "plan_id"?: number }`
- **Logic:**
    - Verifies that all tasks in the entire plan are marked `is_completed`.
    - If true, calls the `award_plan_completion_reward` SQL RPC.
- **Response:** `{ "is_completed": boolean }`.

### `continue-plan`
Just-In-Time generation of the next module's content.
- **Endpoint:** `POST /functions/v1/continue-plan`
- **Body:** `{ "plan_id": string, "module_to_generate": number }`
- **Logic:**
    - Extracts theme/objectives from the `plan_details` JSONB blob.
    - Calls Gemini AI to generate 7 days of granular quests and tasks.
    - Persists data to `quests` and `tasks`.
    - Triggers `generate-quest-stories` in the background.
- **Response:** `200 OK` success message.

---

## 2. AI & Narrative Engines

### `plan-generator`
The core engine for forging new Legends.
- **Endpoint:** `POST /functions/v1/plan-generator`
- **Body:** `{ "goal_text": string, "abandon_previous": boolean }`
- **Logic:**
    - Content moderation check.
    - Parallel AI calls for curriculum, stats, shop items, and icon mapping.
    - Persists the master `plan_details` and populates **Module 1** quests/tasks.
- **Response:** The generated `Plan` JSON object.

### `generate-boss-quiz`
Creates the quiz-combat content.
- **Endpoint:** `POST /functions/v1/generate-boss-quiz`
- **Body:** `{ "plan_id": string, "module_number": number }`
- **Logic:**
    - Fetches module content from DB.
    - Calls Gemini to generate 10 multiple-choice questions.
    - Saves results to `boss_fights` table.
- **Response:** The `boss_fights` record data.

### `oracle-chat`
Streaming persistent mentor.
- **Endpoint:** `POST /functions/v1/oracle-chat`
- **Body:** `{ "message": string }`
- **Logic:**
    - Hourly/Daily rate limit checks on `profiles`.
    - Fetches plan context and chat history.
    - Streams Gemini response.
- **Response:** `text/plain` stream of AI text.

### `adventure-dm`
Orchestrates the text-RPG dungeon.
- **Endpoint:** `POST /functions/v1/adventure-dm`
- **Body:** `{ "message"?: string, "action": "start" | "continue" | "retreat" }`
- **Logic:**
    - `start`: Consumes AP/Keys via RPC, generates dungeon JSON, saves state.
    - `continue`: Processes user input/rolls against the `adventure_states` JSON.
    - `retreat`: Wipes state and history.
- **Response:** `{ "message": string, "status": string, "action"?: object }`.

---

## 3. Business & Economy

### `create-checkout`
Initiates Stripe payments.
- **Endpoint:** `POST /functions/v1/create-checkout`
- **Body:** `{ "successUrl": string, "cancelUrl": string, "mode": "payment" | "subscription", "productType": string }`
- **Response:** `{ "url": string }` (Stripe Checkout URL).

### `stripe-webhook`
Synchronizes Stripe events to the database.
- **Endpoint:** `POST /functions/v1/stripe-webhook`
- **Headers:** Requires `stripe-signature`.
- **Logic:**
    - Verifies signature.
    - Idempotency check via `processed_webhook_events`.
    - Handles `checkout.session.completed`, `customer.subscription.*`.
- **Response:** `200 OK` `{ "received": true }`.

### `purchase-item`
Secure transaction gateway for the shop.
- **Endpoint:** `POST /functions/v1/purchase-item`
- **Body:** `{ "item_id": number, "is_pet_item": boolean }`
- **Logic:** Routes to the correct SQL RPC (`purchase_item` or `purchase_pet_item`).
- **Response:** success message.

---

## 4. Maintenance & Utilities

### `check-trial-expiration` (Cron)
Notifies users before their Pro trial ends.
- **Auth:** Requires `service_role` Bearer token.
- **Window:** Targets trials ending in **24-25 hours**.
- **Response:** `{ "message": string }`.

### `generate-speech` (TTS)
Converts AI text to audio.
- **Endpoint:** `POST /functions/v1/generate-speech`
- **Body:** `{ "text": string }`
- **Logic:** Tries `gemini-2.5-flash-tts`, falls back to Google Cloud TTS.
- **Response:** `{ "audioContent": string, "contentType": string }`.

### `send-feedback`
Dispatches user feedback via email.
- **Body:** `{ "message": string, "type": string, "url"?: string, "name"?: string }`
- **Provider:** Uses **Resend** API.
- **Response:** `{ "success": true }`.
