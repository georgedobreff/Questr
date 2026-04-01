# Subscriptions & Payments

This document provides a comprehensive, code-level breakdown of the Subscription and Payment system in Questr. It explains how recurring Pro subscriptions and one-time item purchases are handled using Stripe, Supabase Edge Functions, and database triggers.

## Part 1: Data Model

The system is centered around the `subscriptions` table, which tracks a user's payment status and links them to a Stripe customer.

### `subscriptions` table

| Column | Type | Description |
|:---|:---|:---|
| `id` | `uuid` | **Primary Key.** |
| `user_id` | `uuid` | **Foreign Key** to `auth.users(id)`. |
| `status` | `text` | The current subscription status (e.g., `free`, `trialing`, `active`, `pro`, `past_due`, `canceled`). |
| `stripe_customer_id` | `text` | The unique ID for the customer in Stripe. |
| `stripe_subscription_id`| `text` | The ID of the active subscription in Stripe. |
| `stripe_price_id` | `text` | The ID of the Stripe Price object the user is currently subscribed to. |
| `stripe_current_period_end`| `timestamptz`| When the current billing period ends. Used for access validation. |
| `created_at` | `timestamptz`| When the subscription record was created. |
| `updated_at` | `timestamptz`| When the record was last updated by a webhook or action. |

---

## Part 2: Initiating Payments (`create-checkout` Edge Function)

When a user wants to subscribe or buy an item, the frontend calls the `create-checkout` Edge Function. This function is responsible for creating a Stripe Checkout Session and returning the URL to the client.

**Endpoint:** `POST /functions/v1/create-checkout`
**Body:** `{ "successUrl": string, "cancelUrl": string, "mode": "subscription" | "payment", "productType": string, "priceId": string }`

### Logic Flow:
1.  **Authentication:** Validates the user's Supabase JWT.
2.  **Customer Management:**
    - Checks the `subscriptions` table for an existing `stripe_customer_id`.
    - If not found, it creates a new Customer in Stripe and saves the ID back to the `subscriptions` table.
3.  **Product Identification:**
    - If `productType` is provided (e.g., `dungeon_key`, `pet_energy_refill`), it retrieves the corresponding Price ID from environment variables (`DUNGEON_KEY_PRICE_ID`, `ENERGY_REFILL_PRICE_ID`).
    - If no `priceId` is provided, it defaults to the `PRO_SUBSCRIPTION_PRICE_ID`.
4.  **Trial Eligibility:**
    - If the user is starting a Pro subscription, the function checks the `profiles` table's `has_had_trial` flag.
    - If `false`, it configures the Stripe session with a 10-day trial period (`trial_period_days: 10`).
5.  **Session Creation:**
    - It creates a Stripe Checkout Session with the selected Price ID, mode (subscription or one-time payment), and metadata (including `user_id` and `price_id`).
    - It explicitly sets `allow_promotion_codes: true` to support discounts.
6.  **Response:** Returns the `url` of the Stripe-hosted checkout page.

---

## Part 3: Handling Updates (`stripe-webhook` Edge Function)

The `stripe-webhook` function is the authoritative source for updating the user's status in the database. It listens for events sent by Stripe.

### Security and Reliability:
- **Signature Verification:** It uses the `stripe-signature` header and the `STRIPE_WEBHOOK_SECRET` to verify that the request truly came from Stripe.
- **Idempotency:** It records every processed event ID in a `processed_webhook_events` table. If the same event is received twice, it's ignored to prevent duplicate processing.

### Event Logic:

#### `checkout.session.completed`
This event is triggered after a successful payment or a successful trial signup.
- It identifies the user via metadata or the `client_reference_id`.
- **Subscription Support:** It saves the `stripe_customer_id` and sets the initial status.
- **One-Time Purchases:** It checks the `price_id` from the session metadata:
    - **Plan Credits:** Calls the `increment_plan_credits` RPC and sends a "Purchase Successful" notification.
    - **Dungeon Keys:** Calls the `add_dungeon_keys` RPC and sends a notification.
    - **Pet Energy:** Directly updates the `user_pets` table to `current_energy: 100` and sends a notification.

#### `customer.subscription.updated` / `customer.subscription.deleted`
These events handle recurring billing and cancellations.
- They update the `status`, `stripe_price_id`, and `stripe_current_period_end` in the `subscriptions` table.
- **Pro Activation:** If the status becomes `active` or `trialing`, the user's `profiles.has_had_trial` is set to `true`, and a welcoming notification is sent.

---

## Part 4: Frontend Integration

The frontend uses the `useGoPro` custom hook to initiate the subscription process.

### `useGoPro` Hook
- **Logic:** Calls the `create-checkout` Edge Function with `mode: 'subscription'`.
- **Redirection:** On success, it performs a hard redirect (`window.location.href = data.url`) to the Stripe checkout page.
- **User Experience:** It uses `toast.loading` to provide feedback while the session is being prepared.

### Subscription Verification Loop
As detailed in the `deep-dive-ai-plan-generation.md`, pages like `onboarding` use a polling loop to wait for the `subscriptions` table to be updated by the webhook after the user returns from Stripe. This is a critical bridge between the external payment flow and the internal application state.

## Part 5: Security & Invariants

- **Authority:** The `stripe-webhook` function is the *only* place that should authoritatively update a user's `subscriptions.status`. It uses a `supabaseAdmin` client (service role) to bypass all RLS.
- **Gating:** The `enter_dungeon` and `plan-generator` functions (and many others) check the `subscriptions` table to verify a user's status (`active`, `trialing`, or `pro`) before allowing access to premium features.
- **Trials:** The `has_had_trial` flag on the `profiles` table ensures a user can only ever benefit from the 10-day free trial once.
