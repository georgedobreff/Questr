-- Performance Indexes for Foreign Keys
-- These prevent linear scans during ON DELETE CASCADE and RLS joins.

-- 1. Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_quest_id ON public.tasks(quest_id);

-- 2. Quests
CREATE INDEX IF NOT EXISTS idx_quests_plan_id ON public.quests(plan_id);

-- 3. User Items
CREATE INDEX IF NOT EXISTS idx_user_items_item_id ON public.user_items(item_id);
-- idx_user_items_user_id is usually covered by the unique(user_id, item_id) but good to be explicit if querying by user_id only often.
-- Actually the UNIQUE constraint (user_id, item_id) covers queries filtering by user_id.

-- 4. User Pets
CREATE INDEX IF NOT EXISTS idx_user_pets_pet_def_id ON public.user_pets(pet_def_id);

-- 5. User Stats
CREATE INDEX IF NOT EXISTS idx_user_stats_plan_id ON public.user_stats(plan_id);

-- 6. Shop Items (Plan specific items if any)
CREATE INDEX IF NOT EXISTS idx_shop_items_plan_id ON public.shop_items(plan_id);
