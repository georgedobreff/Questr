-- Enable realtime for guild_feed table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'guild_feed'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE guild_feed;
    END IF;
END $$;
