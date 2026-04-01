-- Add detailed fields to adventure_states to support richer DM prompts
ALTER TABLE public.adventure_states 
ADD COLUMN locations jsonb,
ADD COLUMN enemies jsonb,
ADD COLUMN puzzles jsonb;
