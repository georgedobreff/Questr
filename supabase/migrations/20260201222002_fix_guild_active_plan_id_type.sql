-- Fix active_plan_id type in guilds table
-- It was incorrectly set as UUID, but plans.id is a BIGINT

-- First, drop the foreign key constraint if it exists (it was created in the previous migration)
ALTER TABLE public.guilds
DROP CONSTRAINT IF EXISTS guilds_active_plan_id_fkey;

-- Alter the column type using USING to convert if necessary (though it's likely null or empty now)
-- Since we know it's failing, we can assume no valid data is there, or we cast.
ALTER TABLE public.guilds
ALTER COLUMN active_plan_id TYPE bigint USING NULL; -- Resetting to NULL to be safe/clean as previous UUIDs wouldn't match bigints anyway

-- Re-add the foreign key constraint pointing to plans(id)
ALTER TABLE public.guilds
ADD CONSTRAINT guilds_active_plan_id_fkey
FOREIGN KEY (active_plan_id) REFERENCES public.plans(id);
