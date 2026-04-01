-- Create a unique index to ensure only one active dungeon per user
-- We use a partial index where is_active is true
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_dungeon_per_user 
ON public.adventure_states (user_id) 
WHERE is_active = true;
