# API Proxy & Resiliency Layer

This document provides a comprehensive, code-level breakdown of the Next.js API layer, which acts as a resilient gateway between the frontend and the Supabase Edge Functions.

---

## Part 1: The Gateway Pattern

Questr uses Next.js Route Handlers (`src/app/api/`) as a proxy layer. Instead of calling Edge Functions directly from the browser, the client calls these local endpoints.

### Why this pattern?
1.  **Uniform Authentication:** The API layer uses `createServerSupabaseClient` to verify the user's session on the server side before forwarding the request.
2.  **Secret Management:** It allows for adding headers or performing logic without exposing function URLs directly to the client.
3.  **Advanced Resiliency:** It provides a place to implement retry logic and custom error handling.

---

## Part 2: Resiliency & Retries (`/api/adventure`)

Interactions with LLMs can be slow or prone to transient network failures. The adventure proxy is designed to be "fail-safe."

### Logic Flow:
- **Loop:** It uses a `while` loop to attempt the connection up to **3 times**.
- **Condition:** It only retries if it encounters a network error or a 5xx server error. If it receives a 4xx (Client Error), it stops and returns the error immediately.
- **Backoff:** It implements a simple 1-second delay between attempts to allow the serverless function environment to stabilize.
- **Gateway Error Handling:** It includes specific logic to detect if the response is HTML (indicating a gateway timeout or WAF error) and converts it into a clean JSON error for the frontend.

---

## Part 3: Stream Forwarding (`/api/chat`)

The Oracle chat experience requires instantaneous feedback. The chat proxy ensures the AI's stream is preserved.

### Logic Flow:
- **No Buffering:** Unlike standard API routes that wait for a full JSON response, this route returns `new NextResponse(response.body)`.
- **Pass-through:** It pipes the raw readable stream from the Supabase Edge Function directly to the client.
- **Headers:** It maintains the `text/plain; charset=utf-8` header to ensure the browser processes the chunks as text.

---

## Part 4: Technical Invariants

- **Runtime:** Both proxies use `export const runtime = 'edge'`. This ensures the proxy itself runs on the Vercel Edge Network, minimizing the "middle-man" latency.
- **Max Duration:** The adventure proxy sets `maxDuration = 60` to allow for the extensive processing time required for AI dungeon generation.
- **JSON Safety:** The layer ensures that even if the backend returns a non-JSON error, the client always receives a structured `{ error: string }` object, preventing client-side "SyntaxError: Unexpected token <" crashes.
