-- Drop unique constraint on shop_items name
-- Date: 2026-01-10

ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_name_key;
