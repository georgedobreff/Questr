# Project Overview: Questr

Questr is a next-generation productivity RPG designed to transform high-level ambitions into actionable, gamified curricula. By combining advanced Large Language Models (Gemini 2.5) with deep gamification psychology, it turns "learning a skill" into a persistent, immersive adventure.

---

## 1. The Core Vision

The mission of Questr is to solve "Goal Overwhelm." Most productivity tools are blank slates; Questr is an active mentor. It bridges the gap between a vague desire (e.g., "I want to be a data scientist") and the daily discipline required to achieve it.

### The Persona Trio:
- **The Dean (Architect):** The AI persona responsible for high-level curriculum design. The Dean ensures that every "Legend" follows university-grade standards and realistic timelines.
- **The Oracle (Mentor):** The interactive AI personality that provides supportive tutoring, explains complex concepts, and keeps the user motivated through streaming chat.
- **The Dungeon Master (Narrative):** The AI persona that runs the text-RPG elements, converting the user's progress into a fantasy story with dice rolls and loot.

---

## 2. The Gameplay Loop

1.  **Forge (Onboarding):** The user defines their goal. The Dean creates a multi-month learning plan (Modules).
2.  **Quest (Daily):** The user is presented with 7 days of tasks for the current module.
3.  **Progression:** Checking tasks grants Coins (Economy), XP (Leveling), and AP (Adventure).
4.  **Challenge (Boss Fight):** Completing a module triggers a quiz-based combat encounter to prove mastery.
5.  **Recharge (Dungeon):** Users spend AP and Keys to enter procedural text-RPG dungeons for rare loot and social bragging rights.

---

## 3. High-Level Tech Stack

- **Frontend:** Next.js 16 (App Router), Tailwind 4, Shadcn/UI, React Three Fiber.
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime).
- **AI:** Google Gemini 2.5 Pro & Flash (TTS, Chat, Generation).
- **Business:** Stripe (Subscriptions, One-off purchases, Customer Portal).

---

## 4. Key Product Values

- **Security First:** No client-side manipulation of game state or currency.
- **Immersion:** Every interaction is wrapped in high-quality 3D visuals and fantasy narrative.
- **Resiliency:** Built to handle the inherent latency of AI generation through robust polling and optimistic UI.
- **Strict Standards:** No `any` types in code, mandatory RLS on all data, and clear separation of concerns between player and pet economies.
