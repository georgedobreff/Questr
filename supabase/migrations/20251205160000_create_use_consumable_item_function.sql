create or replace function public.use_consumable_item(user_item_id_to_use int)
returns table (success boolean, item_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  item_owner_id uuid;
  item_shop_id int;
  item_type text;
  v_item_name text;
begin
  -- Check if the user_item exists and get its details
  select
    ui.user_id,
    ui.item_id,
    si.type,
    si.name
  into
    item_owner_id,
    item_shop_id,
    item_type,
    v_item_name
  from
    user_items ui
  join
    shop_items si on ui.item_id = si.id
  where
    ui.id = user_item_id_to_use;

  -- Ensure the item was found
  if not found then
    raise exception 'Item not found in your inventory.';
  end if;

  -- Verify ownership
  if item_owner_id != auth.uid() then
    raise exception 'You do not own this item.';
  end if;

  -- Verify item type
  if item_type != 'consumable' then
    raise exception 'This item is not usable.';
  end if;

  -- Consume the item (delete it from inventory)
  delete from public.user_items where id = user_item_id_to_use;

  -- Return success and the name of the item used
  return query select true, v_item_name;
end;
$$;
