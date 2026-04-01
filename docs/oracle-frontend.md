# Oracle Chat Frontend

This document provides a comprehensive, code-level breakdown of the interactive chat interface for "The Oracle," focusing on its implementation of AI streaming and natural-feeling text delivery.

---

## Part 1: Stream Orchestration

The Oracle interface is built to handle the high-latency nature of LLM generation while maintaining a responsive user experience.

### 1. The Proxy Bridge
The client does not call the Supabase Edge Function directly. Instead, it calls the local Next.js `/api/chat` route handler. This proxy ensures that the stream is forwarded with the correct headers and authentication context, as documented in `deep-dive-api-proxy-layer.md`.

### 2. Backlog-Aware Typing Simulation
To create a more immersive "Oracle" persona, the frontend simulates a typing process. It uses a dual-loop strategy:
- **Loop 1 (Network):** Reads the raw stream from the reader and accumulates text into a `fullContent` variable as fast as the network allows.
- **Loop 2 (Display):** A "typing loop" that consumes text from `fullContent` and updates the React state `displayedContent`.

**The Intelligence:** The typing loop calculates the "backlog" (difference between received text and displayed text).
- **Backlog > 100 chars:** Types extremely fast (5ms delay).
- **Backlog > 20 chars:** Types moderately fast (15ms delay).
- **Backlog < 20 chars:** Types at a natural reading speed (30ms delay).

This ensures that if the AI provides a massive response, the user isn't stuck waiting for a slow simulation to finish, but still enjoys the initial "typing" effect.

---

## Part 2: State Management & UX

### 1. Pro Gating (Visual & Interaction)
The UI enforces subscription status through both interaction blocks and visual cues:
- **Visual Blur:** Non-pro users see their previous chat history behind a `blur-[3px]` filter, indicating that the content is locked.
- **Interaction Block:** The input field is disabled, and the "Send" button is replaced with an orange, pulsating "Subscribe" button.
- **No-Chat Placeholder:** For new non-pro users, a full-screen "Oracle Locked" hero section is displayed instead of an empty chat box.

### 2. Auto-Scrolling
The interface uses a `messagesEndRef` combined with a `useEffect` hook that triggers `scrollIntoView({ behavior: "smooth" })` whenever the message array or the loading state changes. This keeps the most recent AI text in the user's viewport during long streams.

---

## Part 3: Deep Linking Integration

The chat interface supports a `?q=` search parameter.
- **Logic:** On mount, if the `q` parameter is present, the component automatically triggers the `sendMessage` function with the provided text.
- **Use Case:** This allows the app to have "Ask the Oracle about this" links in the Quest Log or Map, which deep-link the user directly into a relevant AI conversation.

---

## Part 4: Technical Invariants

- **Idempotency:** The auto-send feature uses a `hasSentInitialMessage` ref to ensure the message is only sent once, even if the component re-renders due to hydration.
- **Error Recovery:** If the stream fails, the component removes the partial assistant message and the user's last message, restoring the UI to a consistent state and displaying an error toast.
- **Input Sanitization:** The component enforces a strict 1000-character limit on the client side before even attempting the network request.
