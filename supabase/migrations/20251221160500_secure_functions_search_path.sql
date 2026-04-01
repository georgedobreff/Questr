-- Fix security vulnerability by explicitly setting search_path for functions

ALTER FUNCTION public.award_achievement(uuid, bigint) SET search_path = public;

ALTER FUNCTION public.set_task_completed_at() SET search_path = public;

ALTER FUNCTION public.heal_pet_on_task(uuid) SET search_path = public;

ALTER FUNCTION public.decay_pet_stats(uuid) SET search_path = public;
