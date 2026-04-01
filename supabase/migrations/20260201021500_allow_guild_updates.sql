-- Allow Guild Master to update their own guild (for pinning posts, rules, settings)
CREATE POLICY "Guild Master can update guild" ON public.guilds
    FOR UPDATE
    USING (auth.uid() = master_id)
    WITH CHECK (auth.uid() = master_id);
