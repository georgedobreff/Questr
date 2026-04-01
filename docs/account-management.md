# Account Management & User Control

This document provides a comprehensive, code-level breakdown of the administrative features in Questr, explaining how users manage their profiles, subscriptions, and account lifecycles.

---

## Part 1: Profile Customization (`/settings`)

The Settings page is the primary interface for users to update their metadata and view their status.

### 1. Profile Updates
- **Logic:** Users can update their `full_name` and `age` via a standard form.
- **Backend:** Instead of direct RLS-based updates, the app calls the `update-user-profile` Edge Function.
- **Why?** This allows for server-side sanitization (truncating names) and complex validation logic (age ranges) that would be cumbersome to implement in pure SQL constraints.

### 2. Pro Feature Access
The Settings page acts as a conversion point. It uses the `trigger_upgrade` query parameter pattern to deep-link users from other parts of the app (like the expired trial modal or notifications) directly into the payment flow.

---

## Part 2: Subscription Self-Service

Questr leverages Stripe's hosted infrastructure to provide a professional-grade billing experience.

### 1. The `customer-portal` Edge Function
When a Pro user clicks "Manage Billing," the app calls this function.
- **Logic:** It retrieves the user's `stripe_customer_id` from the `subscriptions` table.
- **Stripe Integration:** It calls `stripe.billingPortal.sessions.create` to generate a secure, one-time URL.
- **UX:** The user is redirected to Stripe's portal, where they can download invoices, change credit cards, or cancel their subscription. They are automatically redirected back to the `/settings` page upon completion.

### 2. The `SubscriptionManager` UI
This component acts as a high-level dashboard for the user's business relationship with Questr.
- **State Aware:** It provides distinct visuals for `Free Trial`, `Subscribed`, and `Not Subscribed` states.
- **Urgency Hooks:** For trial users, it displays the specific expiration date and a primary "Upgrade" button.

---

## Part 3: The Account "Nuclear Option"

Account deletion is handled with extreme care to ensure all third-party and internal state is synchronized.

### 1. Multi-Confirm UX
- **Gating:** Users must explicitly trigger a dialog and type the word "DELETE" to enable the final action.
- **Disclaimer:** The UI warns the user that progress is lost forever and reminds them to cancel subscriptions.

### 2. The `delete-user-account` Cleanup
- **Financial Safety:** The first step is an administrative cancellation of the Stripe subscription.
- **Manual Cascade:** While the database has cascade rules, the function manually wipes data from history, stats, and plan tables to ensure a 100% clean state.
- **Identity Wipe:** Only after the data is purged does the system remove the core `auth.user` record.

---

## Part 4: Technical Invariants

- **Session Continuity:** The app uses `supabase.auth.onAuthStateChange` to monitor the user's session globally. If a user deletes their account or logs out, headless components like `ActivityTracker` and `PasswordRecoveryHandler` automatically unsubscribe from their realtime channels.
- **Error Handling:** Administrative functions use "Fail-Soft" logic—if one part of the data cleanup fails (e.g., a specific table record isn't found), the function logs the error but continues the process to ensure the primary goal of account removal is achieved.
- **Cross-Service Integrity:** The use of Edge Functions for account deletion ensures that the Stripe API and the Supabase DB are updated in the correct sequence, preventing "Zombie Subscriptions" where a user exists in Stripe but not in Questr.
