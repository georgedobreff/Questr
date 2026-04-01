# UI Logic & Data Validation

This document provides a comprehensive, code-level breakdown of how Questr ensures data integrity and handles errors within the user interface.

---

## Part 1: Validation Strategy (Zod & React Hook Form)

Questr uses a "Decentralized Validation" pattern. Instead of a global schema library, validation rules are defined within the specific feature contexts where they are used.

### 1. Form Validation (`new-path/page.tsx`)
The "New Journey" form uses **Zod** to enforce strict limits on AI goal strings:
- **`goal_text` Schema:**
    - `min(10)`: Prevents vague, one-word goals that would result in poor AI curriculum quality.
    - `max(1000)`: Protects the backend from excessive token costs and potential injection attacks.
- **Integration:** React Hook Form (`useForm`) consumes the Zod schema via `@hookform/resolvers/zod`, providing real-time feedback to the user before the Edge Function is even called.

---

## Part 2: Error Handling & Resiliency

The application avoids generic error pages, opting instead for **Contextual Error Recovery**.

### 1. Semantic Error Dialogs
Pages like `/new-path` implement specific visual states for different backend failure modes:
- **Moderation Dialog:** Triggered when the Edge Function returns a `400` status (AI safety flag).
- **Rate Limit Dialog:** Triggered when the user exceeds their weekly quota (`429` status).
- **Timeout Polling:** If a request fails due to a gateway timeout, the UI transitions into a silent polling mode, checking the database for the expected change (e.g., a new plan appearing) before showing an error.

### 2. Global "Not Found" (`not-found.tsx`)
The app uses a custom `not-found.tsx` component to handle invalid URLs, providing a themed "Path Not Found" experience that encourages the user to return to their Quest Log.

---

## Part 3: Headless UI Primitives (Shadcn/UI)

The components in `src/components/ui` are built on Radix UI primitives and styled with Tailwind 4.

### 1. Form Context
The `form.tsx` component provides a `FormFieldContext` and `FormItemContext`. This allows for a declarative syntax where error messages and labels are automatically linked to their respective inputs via ARIA attributes, ensuring the game is fully accessible to screen readers.

### 2. Notification Toasts (`sonner.tsx`)
The app uses **Sonner** for its toast notification engine. It is configured with a custom `Toaster` component in the root layout, which uses the project's OKLCH color variables to ensure toasts match the active theme (Dark/Light).

---

## Part 4: Technical Invariants

- **Client-Side Sanitization:** Forms trim whitespace and normalize case before submission to reduce AI confusion.
- **Fail-Safe Loading:** Buttons use a `loading` state to disable multiple submissions, preventing "Double Forging" of plans or duplicate purchases.
- **Type Safety:** All Zod schemas are converted to TypeScript types using `z.infer`, ensuring the frontend components are perfectly synchronized with the validation rules.
