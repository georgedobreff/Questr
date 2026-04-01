ALTER TABLE public.guilds
ADD COLUMN IF NOT EXISTS pinned_post_id UUID REFERENCES public.guild_feed(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rules TEXT[] DEFAULT ARRAY['Be respectful to fellow members', 'No spamming or self-promotion', 'Participate in guild quests'];
