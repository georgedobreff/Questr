# Database Performance & Scalability

This document provides a comprehensive, code-level breakdown of the architectural decisions and optimizations implemented in the Questr database to ensure high performance and data integrity.

---

## Part 1: Strategic Indexing

Questr uses a targeted indexing strategy to optimize the two most common query patterns: social ranking and relational joins.

### 1. Leaderboard Optimization
To support instantaneous global rankings, specific descending indexes are maintained on the `profiles` table:
- **XP Leaderboard:** `idx_profiles_xp` on `profiles(xp DESC)`
- **Streak Leaderboard:** `idx_profiles_current_streak` on `profiles(current_streak DESC)`
- **Impact:** These indexes allow the `get_leaderboard` function to perform an "Index Scan" instead of a "Sequential Scan" followed by a "Sort," reducing response time from seconds to milliseconds even with millions of users.

### 2. Relational Integrity & Cascades
The project enforces strict relational consistency using `ON DELETE CASCADE`. To prevent these operations from slowing down as the data grows, every major foreign key is indexed:
- **Progression:** `idx_tasks_quest_id`, `idx_quests_plan_id`, `idx_user_stats_plan_id`.
- **Items:** `idx_user_items_item_id`, `idx_shop_items_plan_id`.
- **Pets:** `idx_user_pets_pet_def_id`.
- **Impact:** When a user abandons a plan, the thousands of associated tasks and quests are deleted instantly because the database can quickly locate them via these indexes.

---

## Part 2: Advanced Row-Level Security (RLS) Optimization

RLS is often a performance bottleneck in Supabase applications. Questr implements a "Pro" RLS pattern to minimize overhead.

### The Subquery Pattern
Standard RLS policies like `user_id = auth.uid()` can be slow because the `auth.uid()` function is called for every row. Questr optimizes this by wrapping the call in a subquery:
```sql
CREATE POLICY "Users can view their own pets"
ON public.user_pets FOR SELECT
USING (user_id = (select auth.uid())); -- Optimized subquery wrapper
```
- **Why it works:** PostgreSQL treats the subquery as a constant for the duration of the command, evaluating it once instead of thousands of times. This results in significantly lower CPU usage for large result sets.

---

## Part 3: Secure Data Views

The project avoids direct table access for public features, using instead `SECURITY DEFINER` functions that act as "Controlled Views."

### Data Masking
The `get_leaderboard` function is a prime example of this pattern. It bypasses RLS to read all users (which standard users cannot do) but explicitly selects only safe columns (`full_name`, `xp`, `level`).
- **Privacy:** Sensitive fields like `age`, `email`, or `dungeon_keys` are never exposed through this layer.
- **Performance:** Because it bypasses RLS internally, the query planner has full freedom to use the most efficient index strategy without evaluating user-specific policies.

---

## Part 4: Technical Invariants

- **Index Hygiene:** All indexes are created with `IF NOT EXISTS` to ensure migration idempotency.
- **Constraint Coverage:** The system relies on `UNIQUE` constraints (like `(user_id, item_id)`) to automatically provide unique indexes for common filters, avoiding redundant index creation.
- **Search Path Security:** Performance-critical functions are locked down with `SET search_path = public` to ensure they always target the optimized production tables.
