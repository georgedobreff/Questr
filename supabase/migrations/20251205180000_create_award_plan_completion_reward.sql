create or replace function public.award_plan_completion_reward(p_user_id uuid, p_plan_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_coins_amount int := 500;
  trophy_item_id int;
  plan_owner_id uuid;
begin
  -- Verify ownership of the plan
  select user_id into plan_owner_id from public.plans where id = p_plan_id;
  
  if plan_owner_id != p_user_id then
    raise exception 'User does not own this plan.';
  end if;

  -- Add coins to the user's profile
  update public.profiles
  set coins = coins + reward_coins_amount
  where id = p_user_id;

  -- Upsert the "Trophy" item into the shop_items table to ensure it exists
  insert into public.shop_items (name, description, cost, type, slot, source, asset_url)
  values ('Pathfinder''s Trophy', 'A trophy awarded for seeing a Main Path through to the very end.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  on conflict (name) do update set 
    description = excluded.description,
    source = excluded.source,
    asset_url = excluded.asset_url
  returning id into trophy_item_id;
  
  -- Check if user already has the trophy item from another plan
  if not exists (select 1 from public.user_items where user_id = p_user_id and item_id = trophy_item_id) then
    -- Grant the trophy to the user
    insert into public.user_items (user_id, item_id)
    values (p_user_id, trophy_item_id);
  end if;

end;
$$;
