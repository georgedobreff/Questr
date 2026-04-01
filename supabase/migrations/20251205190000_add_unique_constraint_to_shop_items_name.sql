-- Add a unique constraint to the name column of shop_items to support upserting the trophy item.
ALTER TABLE public.shop_items
ADD CONSTRAINT shop_items_name_key UNIQUE (name);
