# The Pet System

This document provides a comprehensive, code-level breakdown of the Pet System in Questr. It is intended for developers to understand the specific database tables, functions, and logic that govern this feature.

## Part 1: Data Models

The pet system is underpinned by a relational data model in Supabase (PostgreSQL). Below are the detailed schemas for the tables involved.

### `pet_definitions`

This is a static table that defines the *types* of pets that exist in the game. It acts as a template for creating new pet instances.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `text` | **Primary Key.** The unique identifier for the pet type (e.g., 'dog', 'wolf', 'raccoon'). This is the machine-readable name. |
| `name` | `text` | The display name of the pet (e.g., "Dog", "Wolf"). This is the human-readable name. |
| `model_path` | `text` | The path to the 3D `.gltf` model within the `public/` directory. |

---

### `user_pets`

This table stores the dynamic state of each individual pet owned by a user. This is the "living" version of the pet. A user can typically only have one pet at a time, a rule enforced by the `adopt_pet` function.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key.** A unique identifier for this specific pet instance. |
| `user_id` | `uuid` | **Foreign Key** to `auth.users(id)`. The pet's owner. Crucial for RLS. |
| `pet_def_id` | `text` | **Foreign Key** to `pet_definitions(id)`. The type of this pet. |
| `nickname` | `text` | The name given to the pet by the user. |
| `health` | `integer` | The pet's health, typically from 0 to 100. Decays over time if not fed. |
| `happiness` | `integer` | The pet's happiness, from 0 to 100. Decays over time if not interacted with. |
| `status` | `text` | The current state of the pet (e.g., 'alive', 'dead'). |
| `level` | `integer` | The pet's current level, which increases with XP gained from missions. |
| `xp` | `integer` | The pet's experience points. |
| `current_energy`| `integer` | The pet's energy, from 0 to 100. This resource is consumed to start missions. |
| `last_energy_refill_at` | `timestamptz` | The timestamp when the pet's energy was last spent or updated. Used to calculate passive energy regeneration. |
| `unlocked_at` | `timestamptz` | The timestamp when the user first acquired the pet. |
| `last_fed_at` | `timestamptz` | The timestamp when the pet was last fed. Used for health decay calculations. |
| `revival_progress` | `integer` | A value used in the process of reviving a 'dead' pet. |

---

### `pet_items`

This static table defines all consumable items that can be used on pets. It's the master catalog for the pet shop.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | **Primary Key.** The unique identifier for the item. |
| `name` | `text` | The display name of the item (e.g., "Meaty Bone"). |
| `description`| `text` | A user-facing description of the item and its effects. |
| `cost` | `integer` | The price of the item in Gold. |
| `asset_url` | `text` | The filename of the item's icon (e.g., `bone-gnawer.png`). See Asset Conventions section. |
| `pet_species`| `text[]` | An array of `pet_definitions` IDs. If not NULL, this item can only be used by the specified pet types. A `NULL` value means the item is universal. |
| `item_tier` | `integer` | The tier of the item (e.g., 1, 2, 3), indicating its quality. |
| `effect_health`| `integer` | The amount of health this item restores. Can be negative. |
| `effect_happiness`| `integer` | The amount of happiness this item restores. Can be negative. |
| `show_in_shop` | `boolean` | If `true`, the item is visible in the main pet supply shop. |
| `is_full_energy_refill` | `boolean` | If `true`, using this item fully restores a pet's energy to 100, overriding other effects. |

---

### `user_pet_inventory`

This table tracks the quantity of each pet item a user owns, acting as their backpack.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | **Primary Key.** |
| `user_id` | `uuid` | **Foreign Key** to `auth.users(id)`. The inventory owner. |
| `pet_item_id` | `bigint` | **Foreign Key** to `pet_items(id)`. The item being stored. |
| `quantity` | `integer` | The number of this item the user possesses. |

**Constraint:** There is a `UNIQUE` constraint on `(user_id, pet_item_id)` to prevent duplicate rows for the same item.

---

### `pet_missions`

This table stores the state of a pet actively on a mission.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | **Primary Key.** A unique identifier for this specific mission instance. |
| `user_id` | `uuid` | **Foreign Key** to `auth.users(id)`. |
| `pet_id` | `uuid` | **Foreign Key** to `user_pets(id)`. The pet assigned to the mission. |
| `difficulty` | `mission_difficulty` | An `ENUM` type ('easy', 'medium', 'hard'). |
| `status` | `mission_status` | An `ENUM` type ('ongoing', 'completed', 'failed', 'claimed'). |
| `started_at` | `timestamptz` | The timestamp when the mission began. |
| `duration_seconds`| `integer` | The length of the mission in seconds. |
| ...and more | | The table also contains fields for story/flavor text and the rewards. |

## Part 2: Passive Mechanics

These are systems that operate over time, independent of direct user action.

### Pet Energy Regeneration

Pet energy is a resource required to send pets on missions. It regenerates passively over time. This logic is encapsulated in the `get_pet_energy(p_pet_id)` database function.

**Logical Flow:**
1.  The function retrieves the pet's `current_energy` and its `last_energy_refill_at` timestamp.
2.  It calculates the total minutes passed since the last refill (`now() - last_energy_refill_at`).
3.  **Crucially, it subtracts time the pet spent on missions.** It queries the `pet_missions` table to find the duration of any missions that started after the last energy refill, preventing energy from regenerating while the pet is busy.
4.  It applies the regeneration formula: **100 energy is restored over 240 minutes (4 hours)**. The number of eligible minutes is multiplied by this rate (`100.0 / 240.0`).
5.  The restored energy is added to the stored energy.
6.  The final value is capped at 100 and returned as an integer.

This calculation is not run on a timer. Instead, it is executed *on-demand* whenever a pet's energy is needed, for example, when calling the `spend_pet_energy` wrapper function before starting a mission. This is a highly efficient "lazy evaluation" approach.

### Health and Happiness Decay

**Note:** The exact mechanism for stat decay is not present in the provided migration files. It is likely handled by a scheduled job (e.g., using `pg_cron` on Supabase) that runs periodically (e.g., once every hour).

**Assumed Logic:**
1.  A scheduled job runs and scans the `user_pets` table.
2.  For each pet, it checks the `last_fed_at` or a more generic `last_interacted_at` timestamp.
3.  Based on the time elapsed, it decrements the `health` and `happiness` stats by a fixed amount.
4.  This encourages the user to log in daily to care for their pet.

## Part 3: Core Backend Functions (RPC)

These PostgreSQL functions contain the secure, authoritative logic for the pet system. They are called from the frontend via `supabase.rpc(...)`.

### `adopt_pet(p_pet_def_id, p_nickname)`

Allows a user to acquire their first pet.
*See previous documentation for logic flow.*

### `purchase_pet_item(p_pet_item_id)`

Handles the transaction for a user buying a pet item.
*See previous documentation for logic flow.*

### `use_pet_item(p_pet_item_id)`

Applies the effect of a pet item to the user's active pet.
*See previous documentation for logic flow.*

## Part 4: Security Considerations

Securing the pet system is critical to prevent users from granting themselves infinite items or god-mode pets. This is achieved through two primary mechanisms in Supabase.

### Row-Level Security (RLS)

RLS policies are rules that are applied directly to the database tables. Every table in the pet system has RLS enabled.

**Example Policies in Plain English:**
- **On `user_pets`:** "A user can only view, update, or insert a pet record if the `user_id` on that record matches their own session ID (`auth.uid()`)." This means you cannot see or edit anyone else's pet.
- **On `user_pet_inventory`:** "A user can only interact with inventory rows where the `user_id` matches their own." This prevents users from using or deleting items from another user's inventory.
- **On `pet_definitions` and `pet_items`:** "Any user can read from these tables." This is safe because they contain static, public game data like the names and costs of items.

### `SECURITY DEFINER` Functions

You will notice that most functions are created with `SECURITY DEFINER`. This is a crucial security concept.

- **Default (`SECURITY INVOKER`):** A function runs with the permissions of the user who *calls* it.
- **`SECURITY DEFINER`:** The function runs with the permissions of the user who *defined* it (the database administrator).

**Why is this necessary?**
Consider the `purchase_pet_item` function. A user needs to:
1.  Read the `cost` from the public `pet_items` table (which they can do).
2.  Read their own `coins` from the `profiles` table (which they can do because of RLS).
3.  **Update their own `coins`** (which they *cannot* do directly, for obvious security reasons).

By running the function as `SECURITY DEFINER`, the entire transaction runs with administrator privileges. The function can safely check the user's coins and then perform the sensitive update to the `coins` column. The logic inside the function acts as a secure, trusted gatekeeper, only performing the action if all checks (like having enough money) pass.

## Part 5: Asset Conventions

- **3D Pet Models:** Stored in `public/pets/`. They are referenced by the `model_path` in the `pet_definitions` table.
  - Example: `public/pets/Wolf.gltf`
- **2D Item Icons:** Stored in `public/items/`. The path is constructed dynamically in the frontend based on the user's theme.
  - The `asset_url` in the `pet_items` table only contains the filename (e.g., `bone-gnawer.png`).
  - The frontend component (`PetInventory.tsx`) builds the full path like this: `/items/{theme}/{asset_url}`, where `{theme}` is either `white` or `black`.
  - Example path for dark mode: `public/items/white/bone-gnawer.png`
  - Example path for light mode: `public/items/black/bone-gnawer.png`

## Part 6: Frontend Integration
*This section remains the same as the previous version, detailing the `pet-selector-dialog.tsx` and `pet-inventory.tsx` components.*
