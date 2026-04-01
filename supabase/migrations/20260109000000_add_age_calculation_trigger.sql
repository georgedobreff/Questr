-- Function to calculate age
CREATE OR REPLACE FUNCTION public.calculate_age_from_dob()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age = date_part('year', age(CURRENT_DATE, NEW.date_of_birth))::integer;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to run the function automatically
DROP TRIGGER IF EXISTS on_profile_dob_update ON public.profiles;
CREATE TRIGGER on_profile_dob_update
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_age_from_dob();

-- Backfill existing users
UPDATE public.profiles
SET age = date_part('year', age(CURRENT_DATE, date_of_birth))::integer
WHERE date_of_birth IS NOT NULL;
