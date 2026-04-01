-- ============================================
-- ADD BY_QUESTR FLAG TO GUILDS
-- Identifies guilds created by Questr (pre-made)
-- Date: 2026-02-03
-- ============================================

ALTER TABLE public.guilds 
ADD COLUMN IF NOT EXISTS by_questr BOOLEAN DEFAULT false;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_guilds_by_questr ON public.guilds(by_questr);
