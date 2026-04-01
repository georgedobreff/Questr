# Shop & Item Systems

This document provides a comprehensive, code-level breakdown of the in-game economy, focusing on how items are categorized, purchased, and used by the player.

---

## Part 1: Data Models

The item system is split into two distinct tracks: Player items and Pet items.

### 1. Player Items (`shop_items` & `user_items`)

| Table | Description |
|:---|:---|
| `shop_items` | The master catalog of all equipment and consumables. |
| `user_items` | A join table tracking which items a user has acquired. |

**Key Fields in `shop_items`:**
- `type`: `equippable` or `consumable`.
- `slot`: `head`, `torso`, `weapon`, `misc`, or `trophy`.
- `stat_buffs`: A JSONB object (e.g., `{"Strength": 2}`) applied when equipped.
- `source`: Indicates if the item is from the `shop`, a `reward`, or a `dungeon_reward`.

### 2. Pet Items (`pet_items` & `user_pet_inventory`)

These are specialized consumables used to care for pets. They are documented in detail in the `deep-dive-pet-system.md`.

---

## Part 2: The Purchasing Flow

All purchases are handled by the `purchase-item` Supabase Edge Function to ensure security and proper notification delivery.

### Logic Flow (`purchase-item` Edge Function)

1.  **Authentication:** Validates the user's session.
2.  **Routing:**
    - If `is_pet_item` is true, it calls the `purchase_pet_item` RPC.
    - Otherwise, it calls the `purchase_item` RPC.
3.  **Secure Transaction (RPC):**
    - Both RPCs are `SECURITY DEFINER` functions.
    - They atomically check the user's `profiles.coins`, deduct the `cost`, and insert a record into the corresponding inventory table.
4.  **Notification:** After a successful RPC call, the Edge Function inserts a "Purchase Successful" record into the `notifications` table.
5.  **Achievement Check:** It triggers the `check_achievements` RPC to see if the user has unlocked any economy-related badges.

---

## Part 3: Item Usage & Equipment

The logic for using items depends on their `type`.

### 1. Equippable Items
Equipping is handled via the `inventory-manager.tsx` component.

- **Frontend Logic:**
    - The component maintains a state of `equipped_items`.
    - When a user clicks "Equip", it updates the `equipped_items` table in Supabase.
    - The UI immediately reflects the change, and the 3D avatar (via `CharacterViewer`) is updated to show the new gear if applicable.
- **Stat Buffs:**
    - The `stat_buffs` defined in the `shop_items` table are applied to the player's base stats. While the frontend calculates these for display, the authoritative game logic (like the Adventure DM) fetches the equipped items and calculates the buffs on the server during rolls.

### 2. Consumable Items
Consumables are one-time use items that are removed from the inventory after use.

- **Logic Flow (`use-item` Edge Function):**
    - The client calls the `use-item` Edge Function with the `user_item_id`.
    - The function calls the `use_consumable_item` RPC.
    - The RPC verifies ownership and that the item is indeed a `consumable`.
    - **Atomicity:** It `DELETE`s the row from `user_items` in the same transaction as it returns success.
- **The Magic Mirror (Special Case):**
    - This is a unique consumable. When used, the `inventory-manager.tsx` detects the name and opens a special UI that allows the user to change their character's base 3D model path in the `profiles` table.

---

## Part 4: Security (RLS & Invariants)

- **Ownership:** Users can only view their own inventory and only "use" items they own. This is enforced by RLS and the `use_consumable_item` logic.
- **Price Integrity:** Users cannot pass a "price" to the purchase function. The functions fetch the price directly from the `shop_items` or `pet_items` table on the server.
- **Type Safety:** The `use_consumable_item` RPC explicitly prevents users from "consuming" equippable items (which would delete them without providing a buff).
- **Service Role:** Edge Functions use the `service_role` client to perform the final database updates, ensuring that logic remains consistent even if RLS policies are complex.
