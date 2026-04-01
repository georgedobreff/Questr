# AI Adventure Frontend

This document provides a comprehensive, code-level breakdown of the text-based RPG interface used for Dungeons, focusing on its integration with the AI DM, the interactive dice-roll system, and the Text-to-Speech (TTS) engine.

---

## Part 1: The Dungeon Gate (Entry & Gating)

Before an adventure begins, the `/adventure` page acts as a secure lobby.

### 1. Resource Verification
The UI displays a "Dungeon Gate" card that contrasts the **Entry Cost** (12 AP + 1 Key) with the user's **Current Balance**.
- **Visual Gating:** The "Enter Dungeon" button is disabled unless both conditions are met.
- **Economic Integration:** If the user lacks keys, a "Buy Dungeon Key" button appears, which initiates a Stripe session via the `create-checkout` Edge Function.

### 2. Generative Polling
AI dungeon generation is a heavy process that can exceed standard request timeouts.
- **Optimistic State:** When `handleStartDungeon` is clicked, the UI immediately shows a "Forging World..." loader.
- **Database Polling:** If the server request times out, the component enters a **3-second polling interval**. It uses `router.refresh()` to fetch the latest `adventure_states` record. Once the record has a `theme` (indicating generation is complete), the polling stops and the intro message is displayed.

---

## Part 2: Interactive Gameplay Mechanics

The chat interface is more than a simple text box; it is a state-aware game engine.

### 1. The Dice Roll System
The AI DM dictates the flow of combat and exploration through a structured JSON protocol.
- **Action Detection:** If the DM's response includes a `{ action: { type: 'ROLL', ... } }` object, the frontend automatically **disables the chat input**.
- **Interactive UI:** A specialized "ROLL" button is rendered.
- **Roll Simulation:** Clicking the button triggers a client-side `Math.random() * 20` calculation. The result is displayed with a high-impact zoom animation.
- **Automated Resolution:** After a 1.5-second delay, the component automatically sends a message (e.g., "Rolled a 15") to the server. This ensures the user cannot "fudge" the roll by typing their own outcome.

### 2. Status Tracking
The component monitors the `status` field in the AI's response (`PLAYING`, `VICTORY`, `DEFEAT`).
- **End-State Handling:** If a victory or defeat is detected, the component renders a full-width overlay with a "Leave Dungeon" button, which cleans up the server state and redirects the user.

---

## Part 3: Sensory Experience (TTS)

Questr features full voice acting for the Dungeon Master.

### 1. The Speech Pipeline
Each message from the DM includes a "Read Aloud" button.
- **Invocation:** Clicking the button calls the `generate-speech` Edge Function.
- **Audio Handling:** The frontend receives a Base64-encoded WAV/MP3 string. It creates a new `Audio` object using a Data URI (`data:${mimeType};base64,...`) and plays it immediately.
- **UI Feedback:** The button changes to a "Square" (Stop) icon while playing, and a spinner appears during the generation phase.

### 2. Client-Side Caching
To save on API costs and provide instant re-play, the component maintains an `audioCache` object in React state. Once a message has been spoken once, subsequent plays are served directly from memory without a network request.

---

## Part 4: Technical Invariants

- **Resilient Proxies:** All communication with the DM goes through the `/api/adventure` proxy, which provides automatic retries and error sanitization (see `deep-dive-api-proxy-layer.md`).
- **Blur Enforcement:** For non-Pro users, the chat history is blurred (`blur-[3px]`) and interaction is disabled, preventing "freeloading" on AI resources.
- **Scroll Synchronization:** The interface uses a `messagesEndRef` to perform a smooth scroll after every message, ensuring the DM's latest instructions and the dice-roll UI are always visible.
