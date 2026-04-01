# Narrative & Feedback Systems

This document provides a comprehensive, code-level breakdown of the systems that manage the game's story, AI-driven feedback, and sensory experience (TTS).

---

## Part 1: Narrative Continuity (`generate-quest-stories`)

To maintain the feeling of an epic journey, Questr dynamically generates story text for every quest.

### Logic Flow:
1.  **Context Assembly:**
    - If it's the start of a module, it fetches the stories from the previous module.
    - If the user is deeper into the plan, it calls Gemini to **summarize** all previous modules into a single, concise paragraph to provide "historical context" without exceeding token limits.
2.  **AI Invocation (`STORY_GENERATOR_PROMPT`):**
    - The prompt receives the `{MAIN_PLOT}`, the `{HISTORICAL_CONTEXT}`, and the `{CURRENT_QUEST_GOAL}`.
    - Gemini generates a 1-2 sentence bridge that connects the current task to the overall legend.
3.  **Persistence:** The function updates the `quests` table with the newly generated `story` text.

---

## Part 2: Educational Mentoring (`generate-quiz-explanation`)

When a user fails a Boss Fight, the Oracle acts as a mentor rather than just showing an "X".

### Logic Flow:
1.  **Result Analysis:** The function identifies only the questions the user got **wrong**.
2.  **Context Injection:** It fetches the module theme and goal to provide relevant tutoring.
3.  **Streaming AI (`QUIZ_EXPLANATION_PROMPT`):**
    - Gemini analyzes the reasoning behind the mistakes.
    - It provides a Markdown-formatted explanation of the correct concepts.
    - **UX:** Uses a `TransformStream` to deliver the explanation chunk-by-chunk to the client.
4.  **Archiving:** The full explanation is saved to the `boss_fights.explanation` column for later review.

---

## Part 3: The Voice of the Oracle (`generate-speech`)

Questr uses advanced Text-to-Speech to bring the AI responses to life.

### 1. Primary Engine (Gemini TTS)
- **Model:** `gemini-2.5-flash-tts`
- **Voice:** `Algieba` (High-quality, expressive).
- **Technical Detail:** Gemini returns raw PCM audio data. The Edge Function includes a `addWavHeader` helper that programmatically constructs a 44-byte WAV header (RIFF descriptor, fmt sub-chunk, data sub-chunk) so the browser can play the audio as a standard `audio/wav` blob.

### 2. Fallback Engine (Google Cloud TTS)
- **Voice:** `en-US-Studio-M`.
- **Format:** Returns standard MP3 data.
- **Resiliency:** If the Gemini TTS model is unavailable or fails, the system automatically falls back to this production-grade studio voice.

---

## Part 4: Production Feedback (`send-feedback`)

A secure bridge between the user and the development team.

### Logic Flow:
1.  **Context Capture:** Collects the message, the category (Bug, Suggestion, etc.), and the current page URL.
2.  **Email Dispatch (Resend):**
    - Sends a structured HTML email to `support@questr.gg`.
    - Sets the `reply_to` to the user's email, allowing direct communication.
3.  **Confirmation:** Inserts a notification into the user's dashboard to acknowledge receipt.
4.  **Security:** Uses the `RESEND_API_KEY` stored securely in Supabase environment variables.
