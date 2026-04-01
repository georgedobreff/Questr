CREATE OR REPLACE FUNCTION add_coins(user_id_input uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET coins = coins + amount, updated_at = now()
  WHERE id = user_id_input;
END;
$$;
