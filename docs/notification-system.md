# The Notification System

This document provides a comprehensive, code-level breakdown of the Notification system in Questr. It explains how notifications are generated across the stack and delivered to the user in real-time.

---

## Part 1: Data Model

The `notifications` table is the central repository for all user alerts.

### `notifications` table

| Column | Type | Description |
|:---|:---|:---|
| `id` | `bigint` | **Primary Key.** |
| `user_id` | `uuid` | **Foreign Key** to `auth.users(id)`. |
| `title` | `text` | A short, catchy title (e.g., "Achievement Unlocked!"). |
| `message` | `text` | The main body of the notification. |
| `type` | `text` | Categorizes the alert: `info`, `success`, `warning`, `error`, `reward`. Used for UI styling. |
| `action_link` | `text` | Optional. If provided, clicking the notification redirects the user (e.g., `/pet`). |
| `is_read` | `boolean` | Tracks whether the user has seen the notification in the dropdown. |
| `created_at` | `timestamptz`| Timestamp for sorting and displaying "time ago". |

---

## Part 2: Generation Sources

Notifications are generated from almost every part of the Questr stack, ensuring the user is always informed of important events.

### 1. Database Triggers (Automated)
- **`notify_pet_status()`:** A trigger on the `user_pets` table. It automatically creates a `warning` notification if a pet's health drops below 30 or if its status changes to `dead`.

### 2. PostgreSQL RPC Functions (Business Logic)
- **`award_achievement()`:** When a user earns a badge, this function inserts a `success` notification.
- **`award_plan_completion_reward()`:** When the final task of a Legend is finished, this function inserts a `reward` notification with the goal's title.

### 3. Supabase Edge Functions (Asynchronous)
- **`stripe-webhook`:** After a successful purchase (Plan Credits, Dungeon Keys, Pet Energy) or subscription update, it inserts a `success` notification.
- **`adventure-dm`:** When a dungeon is successfully generated or cleared, it inserts a notification with an `action_link` to the adventure page.
- **`plan-generator`:** After a new Legend is forged, it notifies the user.

### 4. Frontend Components (Direct Action)
- **`revive-pet-dialog.tsx`:** After a user successfully revives their pet, the component itself inserts a notification to confirm the success.

---

## Part 3: Real-Time Delivery

Delivery is handled using **Supabase Realtime**, specifically the `postgres_changes` filter. This allows the frontend to respond instantly to new rows in the database without polling.

### 1. Global Toasts (`NotificationsProvider.tsx`)
- **Logic:** This component is rendered at the root of the application layout.
- **Subscription:** It subscribes to a channel for the specific `user_id`:
  ```javascript
  supabase.channel(`user-notifications-toast-${userId}`)
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${userId}` 
    }, (payload) => {
        // Triggers a sonner toast immediately
        toast[payload.new.type](payload.new.title, { description: payload.new.message });
    }).subscribe();
  ```
- **Result:** Whenever a notification is created anywhere (Edge Function, Trigger, etc.), a toast pops up on the user's screen instantly.

### 2. Notifications Dropdown (`NotificationsDropdown.tsx`)
- **Logic:** Renders the bell icon in the navbar.
- **Subscription:** It maintains its own realtime subscription to update the list of notifications and the "unread" badge count without requiring a page refresh.
- **Actions:** It provides UI for "Mark as Read", "Mark All as Read", and "Clear All", which call `UPDATE` or `DELETE` on the `notifications` table.

---

## Part 4: Security (RLS)

Security is strictly enforced via Row-Level Security:
- **`SELECT`:** A user can only see notifications where `user_id = auth.uid()`.
- **`UPDATE`:** A user can only mark their own notifications as read.
- **`INSERT`:** While the frontend can insert some notifications, most sensitive ones (like rewards and payments) are inserted by `SECURITY DEFINER` functions or Edge Functions using the service role, bypassing RLS to ensure integrity.
