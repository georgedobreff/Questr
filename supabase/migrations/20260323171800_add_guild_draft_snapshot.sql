-- ============================================
-- ADD: Guild Draft Plan Snapshot Support
-- Date: 2026-03-23
-- ============================================

-- Add draft_plan_snapshot column to guilds table
ALTER TABLE public.guilds ADD COLUMN IF NOT EXISTS draft_plan_snapshot JSONB DEFAULT null;
