-- Create Guilds table
CREATE TABLE IF NOT EXISTS public.guilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) >= 3 AND char_length(name) <= 50),
    description TEXT CHECK (char_length(description) <= 280),
    master_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Nullable for System Guilds
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    member_count INTEGER DEFAULT 0,
    category TEXT
);

-- IMMEDIATE UPDATE: Add guild_id to profiles so policies can use it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'guild_id') THEN
        ALTER TABLE public.profiles ADD COLUMN guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL;
    END IF;
END $$;

-- RLS for Guilds
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.guilds
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create Guild Activity table
CREATE TABLE IF NOT EXISTS public.guild_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Guild Activity
ALTER TABLE public.guild_activity ENABLE ROW LEVEL SECURITY;

-- Now this policy is safe because profiles.guild_id exists
CREATE POLICY "Members can view guild activity" ON public.guild_activity
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.guild_id = guild_activity.guild_id
        )
    );

-- Create Guild Feed table
CREATE TABLE IF NOT EXISTS public.guild_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Guild Feed
ALTER TABLE public.guild_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view guild feed" ON public.guild_feed
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.guild_id = guild_feed.guild_id
        )
    );

CREATE POLICY "Members can post to guild feed" ON public.guild_feed
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.guild_id = guild_feed.guild_id
        )
    );
