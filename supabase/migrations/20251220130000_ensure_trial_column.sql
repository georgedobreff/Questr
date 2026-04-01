-- Ensure the has_had_trial column exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_had_trial boolean DEFAULT false;

-- Index it for performance
CREATE INDEX IF NOT EXISTS idx_profiles_has_had_trial ON profiles(has_had_trial);
