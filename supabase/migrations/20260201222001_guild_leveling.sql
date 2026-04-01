-- Add Leveling and Quest fields to Guilds
ALTER TABLE public.guilds
ADD COLUMN level integer DEFAULT 1 NOT NULL,
ADD COLUMN xp integer DEFAULT 0 NOT NULL,
ADD COLUMN active_plan_id bigint REFERENCES public.plans(id),
ADD COLUMN quest_start_date timestamp with time zone;

-- Create Guild Task Completions Table
CREATE TABLE public.guild_task_completions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    task_id bigint REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, task_id)
);

-- Enable RLS for Completions
ALTER TABLE public.guild_task_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Members can view completions in their guild
CREATE POLICY "Guild members can view completions" ON public.guild_task_completions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.guild_id = guild_task_completions.guild_id
        )
    );

-- RLS Policy: Users can insert their own completions
CREATE POLICY "Users can complete tasks" ON public.guild_task_completions
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.guild_id = guild_task_completions.guild_id
        )
    );

-- Create Guild Weekly Rewards Table
CREATE TABLE public.guild_weekly_rewards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id uuid REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    module_number integer NOT NULL,
    rewarded_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(guild_id, module_number)
);

-- Enable RLS for Rewards
ALTER TABLE public.guild_weekly_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Members can view rewards
CREATE POLICY "Guild members can view rewards" ON public.guild_weekly_rewards
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.guild_id = guild_weekly_rewards.guild_id
        )
    );
