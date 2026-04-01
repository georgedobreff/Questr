-- Security Hardening Part 2: Automating workflows and locking down tables
-- Date: 2026-01-04

-- 1. Automate Quest Completion
-- When all tasks in a quest are completed, mark the quest as completed.
CREATE OR REPLACE FUNCTION public.sync_quest_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quest_id bigint;
    v_all_completed boolean;
BEGIN
    v_quest_id := COALESCE(NEW.quest_id, OLD.quest_id);

    -- Check if all tasks for this quest are completed
    SELECT NOT EXISTS (
        SELECT 1 FROM public.tasks 
        WHERE quest_id = v_quest_id AND is_completed = false
    ) INTO v_all_completed;

    IF v_all_completed THEN
        UPDATE public.quests 
        SET status = 'completed' 
        WHERE id = v_quest_id AND status != 'completed';
    ELSE
        UPDATE public.quests 
        SET status = 'ongoing' 
        WHERE id = v_quest_id AND status = 'completed';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_quest_status ON public.tasks;
CREATE TRIGGER trigger_sync_quest_status
AFTER UPDATE OF is_completed ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_quest_status();

-- 2. Secure Boss Fight Resolution RPC
CREATE OR REPLACE FUNCTION public.resolve_boss_fight(
    p_fight_id uuid,
    p_status public.boss_fight_status,
    p_player_hp integer,
    p_boss_hp integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cooldown timestamptz := null;
BEGIN
    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.boss_fights WHERE id = p_fight_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Set cooldown if failed
    IF p_status = 'failed' THEN
        v_cooldown := now() + interval '5 minutes';
    END IF;

    UPDATE public.boss_fights
    SET 
        status = p_status,
        player_hp = p_player_hp,
        boss_hp = p_boss_hp,
        cooldown_until = v_cooldown,
        updated_at = now()
    WHERE id = p_fight_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_boss_fight(uuid, public.boss_fight_status, integer, integer) TO authenticated;

-- 3. Lock down remaining tables
-- Drop INSERT/UPDATE/DELETE policies that should only be handled by System (service_role) or Secure RPCs.

-- Plans & Quests
DROP POLICY IF EXISTS "Users can update their own quests" ON public.quests;
DROP POLICY IF EXISTS "Users can update quests for their own plans." ON public.quests;
-- (Note: Plans insert is normally gated by Edge Function, but let's be explicit)
DROP POLICY IF EXISTS "Users can insert their own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can update their own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can delete their own plans" ON public.plans;

-- Chat Histories
DROP POLICY IF EXISTS "Users can insert their own chat history." ON public.chat_history;
DROP POLICY IF EXISTS "Users can update their own chat history." ON public.chat_history;
DROP POLICY IF EXISTS "Users can delete their own chat history." ON public.chat_history;

DROP POLICY IF EXISTS "Users can insert their own adventure chat history." ON public.adventure_chat_history;
DROP POLICY IF EXISTS "Users can delete their own adventure chat history." ON public.adventure_chat_history;

-- User Items (Inventory)
DROP POLICY IF EXISTS "Users can delete their own inventory" ON public.user_items;

-- 4. Harden sync_pet_energy (missing in previous audit)
ALTER FUNCTION public.sync_pet_energy(uuid) SECURITY DEFINER SET search_path = public;
