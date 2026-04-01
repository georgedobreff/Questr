-- First, delete the old seed data from the shop
DELETE FROM public.shop_items;

-- Add the plan_id column to link shop items to a specific plan
-- This will allow each new path to have its own unique set of shop items
ALTER TABLE public.shop_items
ADD COLUMN plan_id bigint references public.plans(id) on delete cascade;

-- Now that the column is added, enforce that it cannot be null for future entries
-- We do this in a separate step to avoid issues if the table already had data
ALTER TABLE public.shop_items
ALTER COLUMN plan_id SET NOT NULL;
