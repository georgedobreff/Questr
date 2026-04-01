# The Selling Economy

This document provides a comprehensive, code-level breakdown of the secondary economy in Questr: the system that allows users to liquidate their inventory back into Gold.

---

## Part 1: Economic Fundamentals

Questr implements a standard "Merchant Buyback" system to help users manage their inventory and recoup value from old equipment.

- **Sell Rate:** All items (both Player Gear and Pet Supplies) are sold back to the Merchant for exactly **50% of their original purchase price** (`floor(cost / 2)`).
- **Hard-Coded Logic:** The sell rate is calculated server-side in the SQL functions, ensuring a consistent economic balance that cannot be manipulated by the client.

---

## Part 2: Backend Logic (RPCs)

The system uses two dedicated PostgreSQL functions, each optimized for its specific data structure.

### 1. Selling Player Gear (`sell_item`)
- **Table:** `user_items` (Unique instances).
- **Logic Flow:**
    1.  Verifies the caller is authenticated.
    2.  Locates exactly one instance ID (`LIMIT 1`) of the item in the user's inventory.
    3.  Fetches the original price from `shop_items`.
    4.  Calculates the sell price.
    5.  **Atomicity:** Deletes the specific item instance and increments the user's `profiles.coins` in a single, safe transaction.

### 2. Selling Pet Supplies (`sell_pet_item`)
- **Table:** `user_pet_inventory` (Stackable items with `quantity`).
- **Logic Flow:**
    1.  Fetches the current `quantity` for the item.
    2.  Fetches the original price from `pet_items`.
    3.  **Decrement Logic:**
        - If `quantity > 1`, it updates the row to `quantity - 1`.
        - If `quantity = 1`, it `DELETE`s the entire row to keep the database clean.
    4.  Updates the user's `profiles.coins`.

---

## Part 3: Security & Hardening

Because selling involves direct modification of the user's currency balance, it is a high-security area.

### 1. Bypassing RLS with `SECURITY DEFINER`
Users are blocked by Row-Level Security from directly updating their own `coins` column (to prevent cheating). The sell functions use `SECURITY DEFINER` to run with administrative privileges, allowing them to perform the coin update *only* after their internal ownership checks have passed.

### 2. Search Path Lockdown
The functions use `SET search_path = public`. This is a critical security best practice in PostgreSQL to prevent "Search Path Hijacking," where a malicious user creates a fake table or function in a different schema to intercept calls from a high-privilege function.

### 3. Permission Revocation
The system explicitly revokes all public execution rights and only grants them to the `authenticated` role:
```sql
REVOKE ALL ON FUNCTION public.sell_item(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.sell_item(bigint) TO authenticated;
```

---

## Part 4: Technical Invariants

- **Fail-Fast Checks:** The functions raise detailed exceptions (`RAISE EXCEPTION`) if an item is not found or the price data is missing, ensuring the client receives clear feedback.
- **Stacking Integrity:** The `sell_pet_item` logic ensures that inventory stacks are managed correctly, preventing negative quantities or orphaned rows.
- **Transaction Consistency:** If the item deletion fails for any reason, the coin update will not occur, preventing "Gold duplication" exploits.
