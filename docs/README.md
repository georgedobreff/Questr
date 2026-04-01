# Questr Project Documentation

Welcome to the comprehensive technical documentation for Questr. This suite of documents is designed to provide new developers with an in-depth, code-level understanding of every system in the project.

---

## 🗺️ Documentation Map

### 1. Fundamentals
- **[Project Overview](./project-overview.md):** Vision, the Persona Trio (Dean, Oracle, DM), and core product values.
- **[Setup Guide](./setup-guide.md):** Exhaustive local environment setup, environment variables, and migration workflow.
- **[Architecture Overview](./architecture-overview.md):** High-level map of the request pipeline, data persistence, and security boundaries.
- **[Development Standards](./development-standards.md):** Mandatory coding rules (no `any`), React patterns, and backend best practices.
- **[Database Schema Reference](./database-schema-reference.md):** Exhaustive table-by-table reference of all columns, types, constraints, and RLS policies.
- **[Database Performance](./db-performance.md):** Technical breakdown of strategic indexing and RLS optimizations.
- **[Library & Types](./lib-and-types.md):** Breakdown of the TypeScript type system and shared utility functions.

### 2. Core Feature Deep Dives
- **[AI Plan Generation](./ai-plan-generation.md):** Detailed breakdown of the `plan-generator` Edge Function, parallel AI chains, and onboarding flow.
- **[AI Asset Mapping](./ai-asset-mapping.md):** Documentation of the weighted fuzzy-matching system used to assign visual assets to AI items.
- **[AI Interactivity](./ai-interactivity.md):** Documentation of the persistent AI mentor and the JSON-driven text RPG system.
- **[The Pet System](./pet-system.md):** Exhaustive guide to pet adoption, missions, energy, and caring mechanics.
- **[Dungeon System](./dungeon-system.md):** Explanation of the unique quiz-based combat and persistent adventure state.
- **[Procedural Journey Map](./journey-map.md):** Geometric and random-walk logic for generating unique user paths.
- **[Shop & Items](./shop-and-items.md):** Code-level look at the economy, inventory management, and item types.
- **[Character & Stats](./character-and-stats.md):** Breakdown of the XP curve, leveling logic, and achievement engine.

### 3. System Infrastructure
- **[API Reference: Edge Functions](./api-reference-edge-functions.md):** Technical catalog of every backend endpoint and its JSON schema.
- **[UI Component Registry](./ui-component-registry.md):** Detailed documentation of every custom React component and its props.
- **[UI Logic & Validation](./ui-logic-and-validation.md):** Code-level breakdown of Zod schemas, form handling, and error recovery.
- **[Frontend State Strategy](./frontend-state-strategy.md):** Explanation of the Context-less architecture and data flow patterns.
- **[DB Triggers & Integrity](./db-triggers-and-security.md):** Exhaustive analysis of the automated SQL logic that enforces security.
- **[Subscriptions & Payments](./subscriptions-payments.md):** Detailed flow of Stripe integration and trial handling.
- **[Notification System](./notification-system.md):** Explanation of the realtime alert engine powered by database triggers.
- **[Plan Management](./plan-management.md):** Documentation of the "Just-In-Time" data strategy and progression logic.
- **[Auth & Profiles](./auth-onboarding-profiles.md):** Deep dive into user identity, onboarding, and profile management.
- **[Account Management](./account-management.md):** Technical details of profile updates, billing portal access, and account deletion.
- **[Routing & Layouts](./routing-and-layouts.md):** Breakdown of global navigation and the inescapable `SubscriptionGuard`.
- **[Theming & Assets](./theming-and-assets.md):** Map of 3D kits, themed icon conventions, and Tailwind 4 setup.
- **[PWA & Offline](./pwa-offline.md):** Technical details of the Progressive Web App implementation.

### 4. Advanced Technicals & Maintenance
- **[Background Systems](./background-systems.md):** Logic for pet missions, energy heartbeats, and trial checkers.
- **[Narrative & Feedback](./narrative-and-feedback.md):** Deep dive into story generation, AI mentoring, and TTS speech.
- **[3D Pipeline](./3d-pipeline.md):** Technical breakdown of R3F preloading, skeleton cloning, and procedural arenas.
- **[User Operations](./user-operations.md):** Documentation of account deletion, session handlers, and legal compliance.
- **[Streaks & Timezones](./streaks-and-timezones.md):** Mathematical breakdown of timezone-aware streak calculations.
- **[API Proxy & Resiliency](./api-proxy-layer.md):** Explanation of the Next.js gateway layer and retry logic.
- **[Frontend Pages](./frontend-pages.md):** Implementation patterns for the Shop, Log, and Pet hub.
- **[AI Adventure Frontend](./adventure-frontend.md):** Analysis of the dice-roll interaction engine and DM UI.
- **[Oracle Frontend](./oracle-frontend.md):** Technical breakdown of character-by-character AI streaming.
- **[Selling Economy](./selling-economy.md):** Breakdown of the secure buyback mechanics and SQL logic.
- **[Social & Character UX](./social-and-character.md):** Documentation of the stat-aggregator logic and leaderboard UI.

### 5. Project Maintenance
- **[Deployment Guide](./deployment-guide.md):** Configuration for Vercel and Supabase production environments.

---

## 🏗️ Technical Philosophy

1.  **Security First:** Every database action is governed by Row-Level Security (RLS). Sensitive logic is always moved to `SECURITY DEFINER` functions or secure Edge Functions.
2.  **Lazy Data:** We avoid database bloat by populating complex learning paths "Just-In-Time" as the user progresses.
3.  **Immersion via AI:** AI is integrated not just as a gimmick, but as a core mechanic for curriculum design, testing (quiz-combat), and narrative.
4.  **Resilient UX:** The frontend is designed to handle the high-latency and timeout-prone nature of LLM generation through robust polling and optimistic UI updates.
