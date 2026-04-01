-- 1. Add snapshot column for strict isolation
ALTER TABLE public.guilds ADD COLUMN active_plan_snapshot JSONB;

-- 2. Drop the direct link to plans (removing the column also drops the foreign key constraint on the column automatically)
ALTER TABLE public.guilds DROP COLUMN active_plan_id;

-- 3. Drop the FK constraint on task completions to allow soft linking (since tasks in snapshot don't exist in tasks table effectively)
-- We need to check if the constraint exists first to avoid errors, although explicit name is preferred
ALTER TABLE public.guild_task_completions DROP CONSTRAINT IF EXISTS guild_task_completions_task_id_fkey;

-- 4. Also drop the FK constraint for 'active_plan_id' on guilds if it wasn't dropped by dropping the column (it usually is, but let's be safe if we didn't drop column - oh wait we did. Leaving this commented)
-- ALTER TABLE public.guilds DROP CONSTRAINT IF EXISTS guilds_active_plan_id_fkey;
