ALTER TABLE public.quests
DROP CONSTRAINT IF EXISTS quests_plan_id_fkey;

ALTER TABLE public.quests
ADD CONSTRAINT quests_plan_id_fkey
FOREIGN KEY (plan_id)
REFERENCES public.plans(id)
ON DELETE CASCADE;
