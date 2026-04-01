-- Drop the old function
DROP FUNCTION IF EXISTS public.add_coins(user_id_input uuid, amount integer);

-- Create a new function to add both coins and xp
CREATE OR REPLACE FUNCTION add_rewards(user_id_input uuid, coin_amount integer, xp_amount integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    coins = coins + coin_amount,
    xp = xp + xp_amount,
    updated_at = now()
  WHERE id = user_id_input;
END;
$$;
