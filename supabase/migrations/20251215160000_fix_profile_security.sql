-- Secure the profiles table against unauthorized stat manipulation via the API

-- 1. Create a trigger function to check for forbidden column updates
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the request is coming from a regular authenticated user (via PostgREST API)
  -- The service_role key will bypass RLS, but triggers still fire.
  -- We identify 'service_role' or internal calls by checking the current role.
  -- However, relying on 'auth.role()' inside a trigger can be tricky if not set correctly.
  -- A safer check for Supabase is often checking the request headers or assuming RLS policies handle the "who".
  -- But here we are specifically blocking columns.
  
  IF (auth.role() = 'authenticated') THEN
    -- Prevent changes to 'coins'
    IF NEW.coins IS DISTINCT FROM OLD.coins THEN
      RAISE EXCEPTION 'Not authorized to update coins directly.';
    END IF;

    -- Prevent changes to 'xp'
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Not authorized to update XP directly.';
    END IF;

    -- Prevent changes to 'level'
    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Not authorized to update level directly.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS protect_profile_stats ON public.profiles;

CREATE TRIGGER protect_profile_stats
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_update_permissions();
