-- Migration: Add title column to adventure_states
-- This stores the dungeon title for display in the UI

ALTER TABLE public.adventure_states 
ADD COLUMN IF NOT EXISTS title TEXT;
