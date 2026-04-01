-- Add dungeon_items column to store the dynamic loot/puzzle items for the session
ALTER TABLE public.adventure_states 
ADD COLUMN dungeon_items jsonb DEFAULT '[]'::jsonb NOT NULL;
