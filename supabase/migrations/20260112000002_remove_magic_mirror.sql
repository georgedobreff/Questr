-- Remove Magic Mirror from shop_items and associated user items
DELETE FROM public.shop_items WHERE name = 'Magic Mirror';
-- Note: Cascading delete on shop_items should handle user_items, equipped_items etc. if configured, 
-- but explicit cleanup is safer if foreign keys aren't set to CASCADE everywhere (though they usually are in this schema).
