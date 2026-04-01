-- Add action_points to profiles
ALTER TABLE public.profiles ADD COLUMN action_points INTEGER DEFAULT 100 NOT NULL;

-- Create table to track the active dungeon state for a user
CREATE TABLE public.adventure_states (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active boolean DEFAULT false NOT NULL,
    theme text,
    win_condition text,
    reward_summary text, -- Simple text description for the user/LLM
    inventory_snapshot jsonb, -- Snapshot of inventory at start (optional, but good context)
    stats_snapshot jsonb, -- Snapshot of stats at start
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.adventure_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own adventure state."
ON public.adventure_states FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own adventure state."
ON public.adventure_states FOR ALL
USING (auth.uid() = user_id);
