# Deployment & Operations Guide

This document details the procedures for deploying Questr to production and managing its live environments.

---

## 1. Primary Hosting

Questr uses a decoupled hosting strategy:
- **Frontend:** [Vercel](https://vercel.com) (Production & Preview deployments).
- **Backend:** [Supabase](https://supabase.com) (Database, Auth, Functions, Storage).

---

## 2. Environment Management

We maintain three primary environments:
1.  **Development:** Personal local machines + individual Supabase projects.
2.  **Staging:** Identical to production, used for final testing of migrations.
3.  **Production:** The live user-facing application (`questr.gg`).

---

## 3. Deployment Workflow

### Step 1: Database Migrations
Before deploying the frontend, schema changes must be applied to the target environment.
```bash
# Push migrations to production
supabase link --project-ref [PROD_REF]
supabase db push
```

### Step 2: Edge Functions
Functions are deployed independently of the frontend.
```bash
# Deploy all functions to production
supabase functions deploy --project-ref [PROD_REF]
```

### Step 3: Frontend (Vercel)
Deployment is automated via Git integration.
- **Preview:** Pushing to any non-main branch creates a preview URL.
- **Production:** Merging into the `main` branch triggers an automatic production build.

---

## 4. Environment Synchronization

### Critical Secrets
The following secrets must be synchronized between Vercel and Supabase Edge Functions:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GEMINI_API_KEY`
- `RESEND_API_KEY`

### Configuration
- **Vercel:** Manage via the Vercel Dashboard (Settings > Environment Variables).
- **Supabase Functions:** Manage via the CLI:
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_test_...
  ```

---

## 5. Monitoring & Health

- **Logs:**
    - Vercel Logs for Server Components and Route Handlers.
    - Supabase Function Logs for AI generation and webhooks.
    - Supabase Postgres Logs for slow queries or RLS errors.
- **Uptime:** Ensure `questr.gg` and the Supabase API endpoint are monitored for availability.
- **Alerts:** Critical errors in the `stripe-webhook` or `plan-generator` should trigger team alerts.
