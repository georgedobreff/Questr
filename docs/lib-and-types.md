# Library & Types

This document provides a comprehensive, code-level breakdown of the core utilities and the type system that unify the Questr frontend and backend.

---

## Part 1: Supabase Client Orchestration

Questr uses the `@supabase/ssr` library to manage authentication and data fetching across both Client and Server components in Next.js.

### 1. Browser Client (`src/lib/supabase/client.ts`)
The browser client is a singleton designed to be reused throughout the client-side lifecycle.
- **Purpose:** Used in `"use client"` components for interactive features (e.g., purchasing items, chat).
- **Initialization:** It uses `createBrowserClient` and environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Optimization:** It checks if a client instance already exists to prevent multiple initializations.

### 2. Server Client (`src/lib/supabase/server.ts`)
The server client is used in Server Components, Server Actions, and Route Handlers.
- **Purpose:** Securely fetches data on the server and handles session state.
- **Logic:** It uses the `cookies` object from `next/headers` to read and write the Supabase JWT.
- **Resiliency:** The `set` and `remove` methods are wrapped in `try/catch` blocks because Next.js only allows cookie modifications in specific contexts (Actions and Handlers, not Server Components).

---

## Part 2: The Type System (`src/lib/types.ts`)

Questr maintains a robust set of TypeScript interfaces that provide end-to-end type safety.

### Core Data Interfaces
The type system mirrors the relational database schema:
- **Plan & Progression:** `Plan`, `Quest`, `Task`.
- **User Metadata:** `Profile`, `UserStat`.
- **Economy:** `ShopItem`, `UserItem`, `EquippedItem`.
- **Pet System:** `PetDefinition`, `UserPet`, `PetItem`, `UserPetInventoryItem`, `PetMission`.
- **Communication:** `Notification`.

### Key Benefits:
- **Intellisense:** Provides developers with accurate auto-completion for complex objects like the nested `Plan` object.
- **Validation:** Used in conjunction with libraries like `zod` to validate API responses and form inputs.
- **Refactoring Safety:** Ensures that database schema changes (reflected in types) are caught across the entire frontend during build time.

---

## Part 3: Shared Utilities (`src/lib/utils.ts`)

- **`cn(...inputs: ClassValue[])`:** A utility that combines `clsx` and `tailwind-merge`. It is used in almost every component to allow for dynamic and clean Tailwind class merging, resolving conflicts automatically.

---

## Part 4: Environmental Invariants

The library relies on several environment variables that must be present:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_FRONTEND_URL` (Used for OAuth redirects)

These are used by the client initializers to ensure the frontend is communicating with the correct Supabase project.
