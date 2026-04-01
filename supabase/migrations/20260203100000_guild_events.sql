-- ============================================
-- GUILD EVENTS TABLE
-- Date: 2026-02-03
-- ============================================

CREATE TABLE IF NOT EXISTS public.guild_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES public.guilds(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 100),
    description TEXT CHECK (char_length(description) <= 500),
    event_date TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.guild_events ENABLE ROW LEVEL SECURITY;

-- Members can view events in their guild
CREATE POLICY "Guild members can view events"
ON public.guild_events FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.guild_id = guild_events.guild_id
));

-- Master can insert events
CREATE POLICY "Master can insert events"
ON public.guild_events FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM guilds WHERE guilds.id = guild_id AND guilds.master_id = auth.uid()
));

-- Master can update events
CREATE POLICY "Master can update events"
ON public.guild_events FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM guilds WHERE guilds.id = guild_id AND guilds.master_id = auth.uid()
));

-- Master can delete events
CREATE POLICY "Master can delete events"
ON public.guild_events FOR DELETE
USING (EXISTS (
    SELECT 1 FROM guilds WHERE guilds.id = guild_id AND guilds.master_id = auth.uid()
));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_guild_events_guild_id ON public.guild_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_events_event_date ON public.guild_events(event_date);
