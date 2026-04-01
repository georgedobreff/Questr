# Development & Coding Standards

This document defines the mandatory technical standards and conventions for the Questr project. Adherence to these rules is required for all contributions.

---

## 1. TypeScript & Type Safety

Questr is a strictly-typed codebase.

- **NO `any`:** The use of the `any` type is forbidden. Every variable, parameter, and return type must have a specific interface or primitive type.
- **Interfaces:** Prefer `interface` over `type` for data objects.
- **Shared Types:** All database-derived objects must use the central definitions in `src/lib/types.ts`.
- **Exhaustive Checks:** When using enums or status strings, use `switch` statements with `default: never` to ensure all cases are handled.

---

## 2. React & Frontend Conventions

- **Server-First:** Fetch data in Server Components whenever possible. Only use `"use client"` for components requiring state, effects, or browser APIs.
- **Component Naming:** Use `kebab-case` for filenames (`task-item.tsx`) and `PascalCase` for the exported component function (`export default function TaskItem`).
- **Styling:** Use Tailwind CSS 4 utility classes exclusively. Avoid custom CSS files. Use the `cn()` utility for all dynamic class merging.
- **Optimistic UI:** For common user actions (completing tasks, buying items), implement optimistic state updates to ensure the app feels responsive.

---

## 3. Backend & Security Best Practices

### PostgreSQL & RLS
- **Mandatory RLS:** Every new table MUST have Row-Level Security enabled.
- **Subquery Pattern:** For performance, always wrap `auth.uid()` in a subquery: `USING (user_id = (select auth.uid()))`.
- **Transaction Safety:** Multi-table updates must be performed within a `SECURITY DEFINER` function to ensure atomicity and proper validation.

### Edge Functions
- **Admin Access:** Only use the `service_role` client inside Edge Functions for operations that the user is logically blocked from performing (e.g., updating their own coin balance).
- **Error Handling:** Functions must always return a JSON object, even on error, to prevent client-side parsing failures.

---

## 4. Asset Conventions

- ** Kenneys Assets:** Maintain the RPG aesthetic by using assets from the approved Kenney kits.
- **Dual-Theme Icons:** New icons must be provided in both `public/items/black` and `public/items/white` folders.
- **GLTF Preloading:** New 3D models must be added to the `ScenePreloader.tsx` component.

---

## 5. Git & PR Workflow

- **Branch Naming:** `<type>/<short-description>` (e.g., `feat/dragon-pet` or `fix/checkout-loop`).
- **Conventional Commits:** Use `feat:`, `fix:`, `docs:`, `chore:` prefixes.
- **Atomic Commits:** Prefer small, focused commits that change one logical part of the system.
