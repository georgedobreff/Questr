-- Optimize RLS policies by wrapping auth.uid() in (select ...) to prevent re-evaluation for each row.
-- Also remove duplicate policies on boss_fights.

-- 1. Boss Fights
DROP POLICY IF EXISTS "Users can read own boss fights" ON public.boss_fights;
DROP POLICY IF EXISTS "Users can read own boss fights." ON public.boss_fights;
DROP POLICY IF EXISTS "Users can view their own boss fights" ON public.boss_fights;
DROP POLICY IF EXISTS "Users can view their own boss fights." ON public.boss_fights;
DROP POLICY IF EXISTS "Users can create their own boss fights" ON public.boss_fights;
DROP POLICY IF EXISTS "Users can create their own boss fights." ON public.boss_fights;
DROP POLICY IF EXISTS "Users can update their own boss fights" ON public.boss_fights;
DROP POLICY IF EXISTS "Users can update their own boss fights." ON public.boss_fights;

CREATE POLICY "Users can view their own boss fights"
ON public.boss_fights FOR SELECT
USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create their own boss fights"
ON public.boss_fights FOR INSERT
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own boss fights"
ON public.boss_fights FOR UPDATE
USING (user_id = (select auth.uid()));


-- 2. User Pet Inventory
DROP POLICY IF EXISTS "Users can view their own pet inventory" ON public.user_pet_inventory;
DROP POLICY IF EXISTS "Users can update their own pet inventory" ON public.user_pet_inventory;

CREATE POLICY "Users can view their own pet inventory"
ON public.user_pet_inventory FOR SELECT
USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own pet inventory"
ON public.user_pet_inventory FOR UPDATE
USING (user_id = (select auth.uid()));


-- 3. Quests (Indirect Relationship)
DROP POLICY IF EXISTS "Users can view quests for their own plans." ON public.quests;
DROP POLICY IF EXISTS "Users can update their own quests." ON public.quests;

CREATE POLICY "Users can view quests for their own plans"
ON public.quests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM plans
        WHERE plans.id = quests.plan_id
        AND plans.user_id = (select auth.uid())
    )
);

CREATE POLICY "Users can update their own quests"
ON public.quests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM plans
        WHERE plans.id = quests.plan_id
        AND plans.user_id = (select auth.uid())
    )
);


-- 4. Tasks (Indirect Relationship)
DROP POLICY IF EXISTS "Users can view tasks for their own quests." ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks." ON public.tasks;

CREATE POLICY "Users can view tasks for their own quests"
ON public.tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM quests
        JOIN plans ON quests.plan_id = plans.id
        WHERE quests.id = tasks.quest_id
        AND plans.user_id = (select auth.uid())
    )
);

CREATE POLICY "Users can update their own tasks"
ON public.tasks FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM quests
        JOIN plans ON quests.plan_id = plans.id
        WHERE quests.id = tasks.quest_id
        AND plans.user_id = (select auth.uid())
    )
);


-- 5. User Achievements
DROP POLICY IF EXISTS "Users can view their own unlocked achievements" ON public.user_achievements;
-- Also check for the old name just in case
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.user_achievements;

CREATE POLICY "Users can view their own unlocked achievements"
ON public.user_achievements FOR SELECT
USING (user_id = (select auth.uid()));


-- 6. User Pets
DROP POLICY IF EXISTS "Users can view their own pets" ON public.user_pets;
DROP POLICY IF EXISTS "Users can update their own pets" ON public.user_pets;
DROP POLICY IF EXISTS "Users can insert their own pets" ON public.user_pets;

CREATE POLICY "Users can view their own pets"
ON public.user_pets FOR SELECT
USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own pets"
ON public.user_pets FOR UPDATE
USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own pets"
ON public.user_pets FOR INSERT
WITH CHECK (user_id = (select auth.uid()));
