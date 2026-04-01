# System Architecture Overview

This document provides a high-level map of the Questr application's data flow, technical boundaries, and integration patterns.

---

## 1. The Core Request Pipeline

Questr uses a multi-layered approach to handle complex AI logic securely.

**Standard Request Flow:**
1.  **Client:** The user interacts with a React component (e.g., clicks "Start Dungeon").
2.  **API Proxy:** The request is sent to a Next.js Route Handler (`src/app/api/adventure/route.ts`).
    - *Purpose:* Verifies user session on the server and provides automatic retry logic.
3.  **Edge Function:** The proxy calls a Supabase Edge Function (`supabase/functions/adventure-dm`).
    - *Purpose:* Orchestrates AI calls, protects the `GEMINI_API_KEY`, and performs administrative DB updates.
4.  **Database (RPC/Trigger):** The Edge Function calls a SQL function (`enter_dungeon`) or updates a table (`adventure_states`).
    - *Purpose:* Final authority on resources and data integrity.
5.  **Response:** The result flows back through the stack to the client UI.

---

## 2. Data Persistence Strategy

- **Relational Integrity:** PostgreSQL is the source of truth. All tables use `ON DELETE CASCADE` and strict foreign keys.
- **Just-In-Time (JIT) Population:** To keep the database lean, only the current learning module is expanded into rows (`quests`/`tasks`). The rest of the future content is stored as a JSONB blob in `plans.plan_details`.
- **Stateless AI:** The AI functions fetch fresh snapshots of the user's state (stats, inventory) from the database before every turn, ensuring the narrative remains consistent.

---

## 3. Communication & Synchronicity

- **Realtime (Real-Time Updates):** The application uses Supabase Realtime to push notifications and sync task completion status across multiple tabs/devices without polling.
- **Streaming:** The Oracle chat uses HTTP streaming to deliver AI text character-by-character, minimizing perceived latency.
- **Webhooks:** Stripe events are processed asynchronously by the `stripe-webhook` function, which acts as the authoritative source for subscription state.

---

## 4. Security Boundaries

- **Client Space:** Limited to reading user-specific data (governed by RLS) and displaying visuals.
- **Server Space (Server Components/Actions):** Handles data aggregation and sensitive redirects.
- **Secure Space (Edge Functions/Triggers):** Performs high-privilege operations (paying for items, leveling up, AI generation).
- **External Space (Stripe):** Authoritative source for financial and payment method data.
