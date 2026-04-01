# Setup & Environment Guide

This document provides the exhaustive technical procedure for setting up a local development environment for Questr.

---

## 1. Prerequisites

- **Node.js:** v20.x or higher.
- **Git:** For version control.
- **Supabase CLI:** [Install guide](https://supabase.com/docs/guides/cli). Required for local migrations and edge functions.
- **Docker:** Required if you intend to run Supabase locally (optional, but recommended for testing functions).

---

## 2. Dependency Installation

```bash
npm install
```

---

## 3. Environment Variables (`.env.local`)

Create a `.env.local` file in the root. You must obtain these keys from the project leads or your personal Supabase/Stripe/Gemini accounts.

### Supabase Connectivity
- `NEXT_PUBLIC_SUPABASE_URL`: Your project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: **SECRET**. Used by server-side clients to bypass RLS.

### Security & AI
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile public key.
- `GEMINI_API_KEY`: **SECRET**. Google AI Studio key for all Oracle/DM functions.

### Payments (Stripe)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Public key.
- `STRIPE_SECRET_KEY`: **SECRET**.
- `STRIPE_WEBHOOK_SECRET`: **SECRET**. Obtain via `stripe listen`.

### Product IDs (Stripe)
- `PRO_SUBSCRIPTION_PRICE_ID`: Recurring price ID.
- `PLAN_CREDIT_PRICE_ID`: One-time plan credit.
- `DUNGEON_KEY_PRICE_ID`: One-time key purchase.
- `ENERGY_REFILL_PRICE_ID`: One-time pet energy.

---

## 4. Database Setup (Migrations)

Questr uses a strictly declarative schema.

### Local Development (Supabase CLI)
1.  Initialize: `supabase init`
2.  Link: `supabase link --project-ref your-project-id`
3.  Pull: `supabase db pull` (to sync your local state)
4.  Apply all migrations: `supabase db reset`

**Warning:** Do not make changes in the Supabase Dashboard UI. All schema changes must be committed via `supabase migration new <name>`.

---

## 5. Edge Functions Deployment

To test AI features locally, you must serve functions or deploy them to your development project:

```bash
# Deploy a single function
supabase functions deploy plan-generator

# Deploy all functions
supabase functions deploy
```

---

## 6. Local Development Server

```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

---

## 7. Webhook Testing

To handle Stripe events locally, use the Stripe CLI to forward events:

```bash
stripe listen --forward-to localhost:3000/api/auth/callback
# Or specifically for the edge function:
stripe listen --forward-to https://[YOUR_REF].supabase.co/functions/v1/stripe-webhook
```
