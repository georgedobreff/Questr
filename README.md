# Questr ⚔️

[![Framework](https://img.shields.io/badge/Framework-Next.js%2016-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/BaaS-Supabase-3ecf8e?style=flat-square&logo=supabase)](https://supabase.com/)
[![Language](https://img.shields.io/badge/Language-TypeScript-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Styling](https://img.shields.io/badge/Styling-Tailwind%204-06b6d4?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Ownership](https://img.shields.io/badge/Ownership-Nemetix-orange?style=flat-square)](https://nemetix.co/)

**Forge Your Path. Master Your Life.**

Questr is a high-fidelity productivity RPG that transforms real-world ambitions into an epic adventure. By merging university-grade curriculum design with deep gamification mechanics and Large Language Models (LLMs), Questr converts vague goals into actionable "Legends"—persistent, immersive learning paths that adapt to your progress.

This is the Open Source version so all LLM prompts have been stripped away. Set up your own however you like. 

---

## 🏛️ Project Vision

Questr is built on the philosophy that self-improvement shouldn't feel like a chore. We use a trio of AI personas to guide the user:
- **The Dean:** Architect of your curriculum.
- **The Oracle:** Your interactive mentor and tutor.
- **The Dungeon Master:** Narrator of your RPG milestones and dungeon runs.

---

## ✨ Key Features

### 🧠 AI-Driven Intelligence
*   **Legend Forging:** Converts any high-level goal (e.g., "Learn Quantum Physics") into a multi-module syllabus.
*   **The Oracle:** A streaming, context-aware AI tutor that provides guidance based on your specific quests and history.
*   **Quiz-Combat:** Module-end "Boss Fights" where combat is driven by your knowledge of the learned material.

### 🎮 Immersive Gamification
*   **3D Hero System:** Custom 3D avatars powered by **React Three Fiber** that reflect your equipped gear.
*   **Companion System:** Adopt and raise pets whose well-being is directly tied to your real-world consistency.
*   **Dungeon Engine:** Procedural text-RPG adventures where you spend earned resources for rare loot.
*   **Seeded Maps:** Every journey generates a unique, persistent world map visual.

### 🛠️ Professional Infrastructure
*   **Secure Economy:** Multi-currency system (Gold, AP, Keys) managed via secure, atomic server-side transactions.
*   **Business Ready:** Integrated Stripe checkout, recurring subscriptions, and a self-service billing portal.
*   **Native Feel:** A high-performance PWA with offline support and real-time notifications.

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **3D Engine:** [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) / Drei
- **State:** Server Components + Optimistic Client State
- **Validation:** Zod + React Hook Form
- **Styling:** Tailwind CSS 4 + Shadcn/UI + Framer Motion

### Backend (Supabase)
- **Database:** PostgreSQL with advanced RLS and custom Triggers
- **Logic:** TypeScript Edge Functions (Deno)
- **Auth:** Supabase Auth with Turnstile protection
- **Realtime:** Postgres Changes for sync & notifications

### AI Layer
- **Engine:** Google Gemini 2.5 (Pro & Flash)
- **Capabilities:** JSON-Mode generation, character-stream chat, and high-quality TTS

## 📖 Internal Documentation

For a deep dive into the architecture, data models, and feature implementations, please refer to our internal documentation hub:

👉 **[Questr Technical Documentation Hub](./docs/README.md)**

Includes:
- **[Database Schema Reference](./docs/database-schema-reference.md)**
- **[API Reference: Edge Functions](./docs/api-reference-edge-functions.md)**
- **[3D Technical Pipeline](./docs/3d-pipeline.md)**
- ...and 30+ other detailed deep-dives.

---

## 🎨 Credits & Assets

*   **3D/2D Assets:** [Kenney.nl](https://kenney.nl) (CC0)
*   **Icons:** Lucide React
*   **Typeface:** Geist & Geist Mono

---

## 🔒 License & Ownership

Copyright © 2026 **Nemetix**. All rights reserved.

This project is proprietary and confidential. Unauthorized copying, distribution, or use of this software via any medium is strictly prohibited. This software is not open-source and is the exclusive property of Nemetix.

