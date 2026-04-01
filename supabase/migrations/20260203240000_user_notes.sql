-- ============================================
-- USER NOTES TABLE
-- Date: 2026-02-03
-- Persistent notes for user dashboard
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);

-- Enable RLS
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Strict RLS policies - users can only access their own notes
CREATE POLICY "Users can read own notes"
ON public.user_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes"
ON public.user_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
ON public.user_notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON public.user_notes FOR DELETE
USING (auth.uid() = user_id);
