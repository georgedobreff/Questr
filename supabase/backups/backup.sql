


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."boss_fight_status" AS ENUM (
    'active',
    'defeated',
    'failed'
);


ALTER TYPE "public"."boss_fight_status" OWNER TO "postgres";


CREATE TYPE "public"."mission_difficulty" AS ENUM (
    'easy',
    'medium',
    'hard'
);


ALTER TYPE "public"."mission_difficulty" OWNER TO "postgres";


CREATE TYPE "public"."mission_status" AS ENUM (
    'ongoing',
    'completed',
    'failed',
    'claimed'
);


ALTER TYPE "public"."mission_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_coins"("user_id_input" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET coins = coins + amount, updated_at = now()
  WHERE id = user_id_input;
END;
$$;


ALTER FUNCTION "public"."add_coins"("user_id_input" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_dungeon_keys"("p_user_id" "uuid", "p_amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.profiles
    SET dungeon_keys = dungeon_keys + p_amount
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."add_dungeon_keys"("p_user_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_rewards"("user_id_input" "uuid", "coin_amount" integer, "xp_amount" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET 
    coins = coins + coin_amount,
    xp = xp + xp_amount,
    updated_at = now()
  WHERE id = user_id_input;
  
  -- Heal Pet
  PERFORM public.heal_pet_on_task(user_id_input);
END;
$$;


ALTER FUNCTION "public"."add_rewards"("user_id_input" "uuid", "coin_amount" integer, "xp_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adopt_pet"("p_pet_def_id" "text", "p_nickname" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_day_one_completed boolean;
BEGIN
    -- Check if user already has a pet
    IF EXISTS (SELECT 1 FROM public.user_pets WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'You already have a companion.';
    END IF;

    -- Check if user completed the first day (Module 1, Day 1)
    SELECT EXISTS (
        SELECT 1
        FROM quests q 
        JOIN plans p ON q.plan_id = p.id 
        WHERE p.user_id = v_user_id 
        AND q.module_number = 1
        AND q.day_number = 1
        AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
        AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0
    ) INTO v_is_day_one_completed;

    IF NOT v_is_day_one_completed THEN
        RAISE EXCEPTION 'You must complete your first day to unlock a companion.';
    END IF;

    INSERT INTO public.user_pets (user_id, pet_def_id, nickname)
    VALUES (v_user_id, p_pet_def_id, p_nickname);
END;
$$;


ALTER FUNCTION "public"."adopt_pet"("p_pet_def_id" "text", "p_nickname" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_achievement"("p_user_id" "uuid", "p_achievement_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_title text;
BEGIN
    -- Check if already has it
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = p_achievement_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (p_user_id, p_achievement_id);
    
    SELECT title INTO v_title FROM public.achievements WHERE id = p_achievement_id;

    -- Add notification
    INSERT INTO public.notifications (user_id, title, message, type, action_link)
    VALUES (p_user_id, 'Achievement Unlocked!', 'You earned: ' || v_title, 'success', '/character');
END;
$$;


ALTER FUNCTION "public"."award_achievement"("p_user_id" "uuid", "p_achievement_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  reward_coins_amount int := 2000;
  trophy_item_id int;
  plan_owner_id uuid;
  plan_goal text;
  plan_claimed boolean;
BEGIN
  -- Verify ownership and claim status
  SELECT user_id, goal_text, is_reward_claimed INTO plan_owner_id, plan_goal, plan_claimed 
  FROM public.plans 
  WHERE id = p_plan_id;
  
  IF plan_owner_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF plan_owner_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF plan_claimed THEN
    RETURN;
  END IF;

  -- Add coins
  UPDATE public.profiles
  SET coins = coins + reward_coins_amount
  WHERE id = p_user_id;

  -- Mark plan as claimed
  UPDATE public.plans
  SET is_reward_claimed = true
  WHERE id = p_plan_id;

  -- Award Trophy
  INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url)
  VALUES ('Pathfinder''s Trophy', 'A trophy awarded for completion.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    source = 'reward',
    asset_url = EXCLUDED.asset_url
  RETURNING id INTO trophy_item_id;
  
  IF NOT EXISTS (SELECT 1 FROM public.user_items WHERE user_id = p_user_id AND item_id = trophy_item_id) THEN
    INSERT INTO public.user_items (user_id, item_id)
    VALUES (p_user_id, trophy_item_id);
  END IF;

  -- Add notification
  INSERT INTO public.notifications (user_id, title, message, type, action_link)
  VALUES (p_user_id, 'Journey Complete!', 'Congratulations! You mastered: ' || plan_goal, 'reward', '/path');
END;
$$;


ALTER FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  reward_coins_amount int := 2000; -- Updated to 2000
  trophy_item_id int;
  plan_owner_id uuid;
  plan_claimed boolean;
BEGIN
  -- Verify ownership and claim status
  SELECT user_id, is_reward_claimed INTO plan_owner_id, plan_claimed
  FROM public.plans
  WHERE id = p_plan_id;

  IF plan_owner_id != p_user_id THEN
    RAISE EXCEPTION 'User does not own this plan.';
  END IF;

  IF plan_claimed THEN
    RETURN;
  END IF;

  -- Add coins to the user's profile
  UPDATE public.profiles
  SET coins = coins + reward_coins_amount
  WHERE id = p_user_id;

  -- Mark plan as claimed
  UPDATE public.plans
  SET is_reward_claimed = true
  WHERE id = p_plan_id;

  -- Upsert the "Trophy" item
  INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url)
  VALUES ('Pathfinder''s Trophy', 'A trophy awarded for seeing a Main Path through to the very end.', 0, 'equippable', 'trophy', 'reward', 'trophy.png')
  ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    source = EXCLUDED.source,
    asset_url = EXCLUDED.asset_url
  RETURNING id INTO trophy_item_id;

  -- Grant the trophy to the user
  INSERT INTO public.user_items (user_id, item_id)
  VALUES (p_user_id, trophy_item_id)
  ON CONFLICT DO NOTHING;

END;
$$;


ALTER FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_achievements"("user_id_input" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    -- Stats variables
    v_completed_tasks integer;
    v_completed_modules integer;
    v_completed_plans integer;
    v_level integer;
    v_xp integer;
    v_current_coins integer;
    v_items_purchased integer;
    v_login_streak integer;
    v_timezone text;
    v_achievements_unlocked integer;
    
    -- Achievement IDs and Data
    r_achievement RECORD;
    
BEGIN
    -- 1. GATHER USER STATS
    
    -- Basic Counts
    SELECT count(*) INTO v_completed_tasks FROM tasks t JOIN quests q ON t.quest_id = q.id JOIN plans p ON q.plan_id = p.id WHERE p.user_id = user_id_input AND t.is_completed = true;
    
    -- Modules (Quests where all tasks are completed)
    SELECT count(*) INTO v_completed_modules 
    FROM quests q 
    JOIN plans p ON q.plan_id = p.id 
    WHERE p.user_id = user_id_input 
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0 -- Has tasks
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0; -- No incomplete tasks
    
    -- Plans (Plans where all tasks in all quests are completed)
    SELECT count(*) INTO v_completed_plans 
    FROM plans p
    WHERE p.user_id = user_id_input 
    AND (SELECT count(*) FROM tasks t JOIN quests q ON t.quest_id = q.id WHERE q.plan_id = p.id) > 0 -- Has tasks
    AND (SELECT count(*) FROM tasks t JOIN quests q ON t.quest_id = q.id WHERE q.plan_id = p.id AND t.is_completed = false) = 0; -- No incomplete tasks
    
    -- Profile Stats (Level, XP, Coins, Streak, Timezone)
    SELECT level, xp, coins, current_streak, timezone 
    INTO v_level, v_xp, v_current_coins, v_login_streak, v_timezone 
    FROM profiles WHERE id = user_id_input;
    
    -- Default timezone if null
    IF v_timezone IS NULL THEN
        v_timezone := 'UTC';
    END IF;
    
    -- Items Purchased
    SELECT count(*) INTO v_items_purchased FROM user_items WHERE user_id = user_id_input;
    
    -- Meta Achievement Count
    SELECT count(*) INTO v_achievements_unlocked FROM user_achievements WHERE user_id = user_id_input;
    
    -- 2. CHECK SPECIFIC ACHIEVEMENTS
    FOR r_achievement IN 
        SELECT * FROM achievements a 
        WHERE NOT EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.achievement_id = a.id AND ua.user_id = user_id_input)
    LOOP
        
        -- --- PROGRESSION ---
        IF r_achievement.code = 'first-steps' AND v_completed_tasks >= 1 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'on-a-roll' AND v_completed_tasks >= 10 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'task-master' AND v_completed_tasks >= 50 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'productivity-powerhouse' AND v_completed_tasks >= 100 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'grandmaster-of-tasks' AND v_completed_tasks >= 500 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
            
        ELSIF r_achievement.code = 'pathfinder' AND v_completed_modules >= 1 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'module-master' AND v_completed_modules >= 5 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'storyteller' AND v_completed_modules >= 10 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
            
        ELSIF r_achievement.code = 'journeys-end' AND v_completed_plans >= 1 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'serial-achiever' AND v_completed_plans >= 3 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);

        -- --- TIME BASED (Timezone Aware) ---
        ELSIF r_achievement.code = 'early-bird' THEN
            IF EXISTS (
                SELECT 1 FROM tasks t JOIN quests q ON t.quest_id = q.id JOIN plans p ON q.plan_id = p.id 
                WHERE p.user_id = user_id_input AND t.completed_at IS NOT NULL 
                AND EXTRACT(HOUR FROM (t.completed_at AT TIME ZONE v_timezone)) < 8
            ) THEN
                PERFORM award_achievement(user_id_input, r_achievement.id);
            END IF;
            
        ELSIF r_achievement.code = 'night-owl' THEN
            IF EXISTS (
                SELECT 1 FROM tasks t JOIN quests q ON t.quest_id = q.id JOIN plans p ON q.plan_id = p.id 
                WHERE p.user_id = user_id_input AND t.completed_at IS NOT NULL 
                AND EXTRACT(HOUR FROM (t.completed_at AT TIME ZONE v_timezone)) >= 22
            ) THEN
                PERFORM award_achievement(user_id_input, r_achievement.id);
            END IF;
            
        ELSIF r_achievement.code = 'weekend-warrior' THEN
            -- Check for 5 tasks completed on Weekends (ISODOW 6 or 7)
            IF (
                SELECT count(*) FROM tasks t JOIN quests q ON t.quest_id = q.id JOIN plans p ON q.plan_id = p.id 
                WHERE p.user_id = user_id_input AND t.completed_at IS NOT NULL 
                AND EXTRACT(ISODOW FROM (t.completed_at AT TIME ZONE v_timezone)) IN (6, 7)
            ) >= 5 THEN
                PERFORM award_achievement(user_id_input, r_achievement.id);
            END IF;

        -- --- CHARACTER ---
        ELSIF r_achievement.code = 'level-up' AND v_level >= 2 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'apprentice' AND v_level >= 5 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'journeyman' AND v_level >= 10 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'adept' AND v_level >= 15 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'expert' AND v_level >= 20 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'master' AND v_level >= 25 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'grandmaster' AND v_level >= 30 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'legend' AND v_level >= 50 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'mythic' AND v_level >= 75 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'ascended' AND v_level >= 100 THEN
            PERFORM award_achievement(user_id_input, r_achievement.id);
            
        -- --- ECONOMY ---
        ELSIF r_achievement.code = 'savings-account' AND v_current_coins >= 1000 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'big-spender' AND v_items_purchased >= 1 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'collector' AND v_items_purchased >= 5 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'curator' AND v_items_purchased >= 15 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'fully-equipped' AND v_items_purchased >= 20 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);

        -- --- ENGAGEMENT / STREAKS ---
        ELSIF r_achievement.code = 'determined' AND v_login_streak >= 3 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'daily-grinder' AND v_login_streak >= 5 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'unstoppable' AND v_login_streak >= 7 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'devoted' AND v_login_streak >= 14 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
        ELSIF r_achievement.code = 'marathon-runner' AND v_login_streak >= 30 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);
             
        -- --- META ---
        ELSIF r_achievement.code = 'questor' AND v_achievements_unlocked >= 25 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);

        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."check_achievements"("user_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_item_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if the user possesses the item in their inventory (user_items)
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_items 
    WHERE user_id = NEW.user_id 
    AND item_id = NEW.item_id
  ) THEN
    RAISE EXCEPTION 'You do not own this item.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_item_ownership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_profile_update_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if the current effective user is a restricted web role.
  -- 'authenticated' = Logged in user via API
  -- 'anon' = Public user via API
  IF CURRENT_USER IN ('authenticated', 'anon') THEN
    
    -- Prevent changes to 'coins'
    IF NEW.coins IS DISTINCT FROM OLD.coins THEN
      RAISE EXCEPTION 'Not authorized to update coins directly.';
    END IF;

    -- Prevent changes to 'xp'
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Not authorized to update XP directly.';
    END IF;

    -- Prevent changes to 'level'
    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Not authorized to update level directly.';
    END IF;
    
  END IF;
  
  -- If CURRENT_USER is 'postgres', 'service_role', etc., allow the update.
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_profile_update_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_task_update_permissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only allow updates to 'is_completed' for authenticated users
  IF (auth.role() = 'authenticated') THEN
    -- Prevent changing rewards
    IF NEW.reward_coins IS DISTINCT FROM OLD.reward_coins THEN
      RAISE EXCEPTION 'Not authorized to update task rewards.';
    END IF;

    -- Prevent changing the task description/title
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Not authorized to update task title.';
    END IF;
    
    -- Prevent changing description if it exists (columns vary by migration, using robust check or known schema)
    -- Schema has 'title' and 'short_description' based on types.ts, or 'description' in SQL.
    -- Migration 20251122180000 renamed/added. Let's assume standard columns.
    -- To be safe, we just check the sensitive one: reward_coins.
    
    -- Prevent moving the task to another quest
    IF NEW.quest_id IS DISTINCT FROM OLD.quest_id THEN
      RAISE EXCEPTION 'Not authorized to move tasks between quests.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_task_update_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decay_pet_stats"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_new_health integer;
    v_current_modules integer;
    v_subscription_status text;
    v_decay_amount integer := 10;
BEGIN
    -- Check Subscription Status
    SELECT status INTO v_subscription_status FROM public.subscriptions WHERE user_id = p_user_id;

    -- If not active, trialing, or pro, double the decay
    IF v_subscription_status NOT IN ('active', 'trialing', 'pro') THEN
        v_decay_amount := 20;
    END IF;

    -- Calculate current completed modules count
    SELECT count(*) INTO v_current_modules 
    FROM quests q 
    JOIN plans p ON q.plan_id = p.id 
    WHERE p.user_id = p_user_id 
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0;

    -- Update Pet
    UPDATE public.user_pets
    SET 
        health = GREATEST(0, health - v_decay_amount),
        happiness = GREATEST(0, happiness - 5),
        status = CASE 
            WHEN health - v_decay_amount <= 0 THEN 'dead' 
            ELSE status 
        END,
        -- If dying now, snapshot the current modules count
        revival_progress = CASE 
            WHEN health - v_decay_amount <= 0 AND status = 'alive' THEN v_current_modules
            ELSE revival_progress 
        END
    WHERE user_id = p_user_id AND status = 'alive';
END;
$$;


ALTER FUNCTION "public"."decay_pet_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enter_dungeon"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_ap int;
    v_keys int;
    v_status text;
BEGIN
    -- Check Subscription Status
    SELECT status INTO v_status
    FROM public.subscriptions
    WHERE user_id = p_user_id;

    IF v_status NOT IN ('active', 'trialing', 'pro') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pro Subscription required'
        );
    END IF;

    -- Check Resources
    SELECT action_points, dungeon_keys INTO v_ap, v_keys
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_ap >= 12 AND v_keys >= 1 THEN
        UPDATE public.profiles
        SET action_points = action_points - 12,
            dungeon_keys = dungeon_keys - 1
        WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object(
            'success', false, 
            'error', CASE 
                WHEN v_ap < 12 THEN 'Not enough Action Points (12 required)'
                WHEN v_keys < 1 THEN 'No Dungeon Keys remaining'
                ELSE 'Insufficient resources'
            END
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."enter_dungeon"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leaderboard"("sort_by" "text" DEFAULT 'xp'::"text", "limit_count" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "full_name" "text", "xp" integer, "level" integer, "current_streak" integer, "coins" integer, "character_model_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Input validation
    IF sort_by NOT IN ('xp', 'current_streak', 'coins') THEN
        sort_by := 'xp';
    END IF;

    -- Clamp limit
    IF limit_count > 100 THEN
        limit_count := 100;
    END IF;

    RETURN QUERY EXECUTE format(
        'SELECT 
            id, 
            full_name, 
            xp, 
            level, 
            current_streak, 
            coins,
            character_model_path 
         FROM profiles 
         ORDER BY %I DESC 
         LIMIT %L',
        sort_by, 
        limit_count
    );
END;
$$;


ALTER FUNCTION "public"."get_leaderboard"("sort_by" "text", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pet_energy"("p_pet_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_last_refill timestamptz;
    v_stored_energy integer;
    v_minutes_passed double precision;
    v_restored_energy integer;
BEGIN
    SELECT last_energy_refill_at, current_energy INTO v_last_refill, v_stored_energy
    FROM public.user_pets
    WHERE id = p_pet_id;

    IF v_last_refill IS NULL THEN
        RETURN 100;
    END IF;

    -- If a mission is ongoing, return the frozen value
    IF EXISTS (SELECT 1 FROM public.pet_missions WHERE pet_id = p_pet_id AND status = 'ongoing') THEN
        RETURN v_stored_energy;
    END IF;

    -- Calculate linear restoration: 100 energy / 240 minutes
    v_minutes_passed := extract(epoch from (now() - v_last_refill)) / 60.0;
    v_restored_energy := floor(v_minutes_passed * (100.0 / 240.0));
    
    RETURN LEAST(100, GREATEST(0, v_stored_energy + v_restored_energy));
END;
$$;


ALTER FUNCTION "public"."get_pet_energy"("p_pet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_xp_threshold"("p_level" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT FLOOR(100 * POWER(p_level::numeric, 1.5))::int;
$$;


ALTER FUNCTION "public"."get_xp_threshold"("p_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_subscription_key_awards"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_key_amount integer;
BEGIN
    -- Check if the status transitioned to trialing/active OR if the period was extended (renewal)
    -- We use stripe_current_period_end as the marker for a new billing cycle
    IF (NEW.status IN ('trialing', 'active')) AND 
       (OLD.status IS NULL OR OLD.status = 'free' OR NEW.stripe_current_period_end > OLD.stripe_current_period_end OR NEW.status != OLD.status) THEN
        
        -- Logic: 1 Key for Trial, 5 for Paid
        IF NEW.status = 'trialing' AND (OLD.status IS NULL OR OLD.status = 'free') THEN
            v_key_amount := 1;
        ELSIF NEW.status = 'active' THEN
            v_key_amount := 5;
        ELSE
            -- No keys for status transitions that don't involve starting/renewing
            RETURN NEW;
        END IF;

        -- Award the keys
        UPDATE public.profiles
        SET dungeon_keys = dungeon_keys + v_key_amount
        WHERE id = NEW.user_id;

        RAISE NOTICE 'Awarded % dungeon keys to user %', v_key_amount, NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_subscription_key_awards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_task_rewards"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
    v_reward_coins integer;
    v_module_number integer;
    v_base_xp integer;
    v_multiplier numeric;
    v_final_xp integer;
    v_reward_ap integer := 1; -- CHANGED: Reduced to 1
BEGIN
    -- Only process strictly on completion
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        
        -- Get Context (User ID and Module Number)
        SELECT p.user_id, q.module_number 
        INTO v_user_id, v_module_number
        FROM public.plans p
        JOIN public.quests q ON q.plan_id = p.id
        WHERE q.id = NEW.quest_id;

        -- Calculate Rewards
        v_reward_coins := NEW.reward_coins;
        
        -- Smart XP Formula: Base (Coins * 10) * Multiplier (1 + Module * 0.1)
        v_base_xp := v_reward_coins * 10;
        v_multiplier := 1.0 + (COALESCE(v_module_number, 1) * 0.1);
        v_final_xp := FLOOR(v_base_xp * v_multiplier)::int;

        -- Update Profile (Coins + XP + AP)
        UPDATE public.profiles
        SET 
            coins = coins + v_reward_coins,
            xp = xp + v_final_xp,
            action_points = action_points + v_reward_ap
        WHERE id = v_user_id;

        -- Process Level Up (if XP overflowed)
        PERFORM public.process_level_up(v_user_id);
        
        -- Heal Pet (if alive)
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'heal_pet_on_task') THEN
             PERFORM public.heal_pet_on_task(v_user_id);
        END IF;

        -- Mark Metadata
        NEW.is_rewarded := true;
        NEW.completed_at := now();
        
        -- Check Achievements (Keep existing hook)
        PERFORM public.check_achievements(v_user_id);
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_task_rewards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."heal_pet_on_task"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.user_pets
    SET 
        health = LEAST(100, health + 5),
        happiness = LEAST(100, happiness + 2)
    WHERE user_id = p_user_id AND status = 'alive';
END;
$$;


ALTER FUNCTION "public"."heal_pet_on_task"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."heartbeat_pet_energy"("p_pet_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_energy integer;
    v_last_refill timestamptz;
    v_minutes_passed float;
    v_restored_energy integer;
    v_new_total integer;
BEGIN
    -- 1. Get current saved state
    SELECT current_energy, last_energy_refill_at INTO v_current_energy, v_last_refill
    FROM public.user_pets
    WHERE id = p_pet_id AND user_id = auth.uid();

    IF v_current_energy IS NULL THEN
        RETURN 0;
    END IF;

    -- 2. If mission is ongoing, regeneration is frozen. Return saved value.
    IF EXISTS (SELECT 1 FROM public.pet_missions WHERE pet_id = p_pet_id AND status = 'ongoing') THEN
        RETURN v_current_energy;
    END IF;

    -- 3. Calculate restoration (100% in 4 hours = 1% every 2.4 minutes)
    v_minutes_passed := extract(epoch from (now() - v_last_refill)) / 60.0;
    v_restored_energy := floor(v_minutes_passed * (100.0 / 240.0));

    IF v_restored_energy < 1 THEN
        RETURN v_current_energy; -- Nothing to update yet
    END IF;

    v_new_total := LEAST(100, v_current_energy + v_restored_energy);

    -- 4. Persist to DB and reset the calculation baseline
    UPDATE public.user_pets
    SET current_energy = v_new_total,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;

    RETURN v_new_total;
END;
$$;


ALTER FUNCTION "public"."heartbeat_pet_energy"("p_pet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_plan_credits"("user_id_input" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET purchased_plan_credits = purchased_plan_credits + amount   
  WHERE id = user_id_input;
END;
$$;


ALTER FUNCTION "public"."increment_plan_credits"("user_id_input" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_profile_coins"("p_user_id" "uuid", "p_amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.profiles
    SET coins = coins + p_amount
    WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."increment_profile_coins"("p_user_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."instantiate_journey_template"("p_template_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_content jsonb;
    v_plan_data jsonb;
    v_stats_data jsonb;
    v_shop_items_data jsonb;
    v_new_plan_id bigint;
    v_module jsonb;
    v_quest jsonb;
    v_new_quest_id bigint;
BEGIN
    -- Get the template content
    SELECT content INTO v_content FROM public.journey_templates WHERE id = p_template_id;
    
    IF v_content IS NULL THEN
        RAISE EXCEPTION 'Template not found';
    END IF;

    v_plan_data := v_content->'plan';
    v_stats_data := v_content->'stats';
    v_shop_items_data := v_content->'shop_items';

    -- 1. Insert Plan
    INSERT INTO public.plans (
        user_id,
        goal_text,
        complexity,
        total_estimated_duration_weeks,
        total_estimated_modules,
        plot,
        plan_details
    ) VALUES (
        p_user_id,
        (v_plan_data->>'goal_title'),
        'pro', 
        (v_plan_data->>'total_estimated_duration_weeks')::int,
        jsonb_array_length(v_plan_data->'modules'),
        (v_plan_data->>'plot'),
        v_plan_data
    ) RETURNING id INTO v_new_plan_id;

    -- 2. Insert Stats
    IF v_stats_data IS NOT NULL AND jsonb_array_length(v_stats_data) > 0 THEN
        INSERT INTO public.user_stats (user_id, plan_id, name, value)
        SELECT 
            p_user_id, 
            v_new_plan_id, 
            x->>'name', 
            (x->>'value')::int
        FROM jsonb_array_elements(v_stats_data) x;
    END IF;

    -- 3. Insert Shop Items
    IF v_shop_items_data IS NOT NULL AND jsonb_array_length(v_shop_items_data) > 0 THEN
        INSERT INTO public.shop_items (plan_id, name, description, cost, asset_url, slot, type, stat_buffs)
        SELECT 
            v_new_plan_id, 
            x->>'name', 
            x->>'description', 
            (x->>'cost')::int, 
            x->>'asset_url', 
            x->>'slot',
            COALESCE(x->>'type', 'equippable'),
            x->'stat_buffs'
        FROM jsonb_array_elements(v_shop_items_data) x;
    END IF;

    -- 4. Insert Quests and Tasks
    -- Iterate through modules
    FOR v_module IN SELECT * FROM jsonb_array_elements(v_plan_data->'modules')
    LOOP
        -- Iterate through daily quests in the module
        FOR v_quest IN SELECT * FROM jsonb_array_elements(v_module->'daily_quests')
        LOOP
            -- Insert Quest
            INSERT INTO public.quests (
                plan_id,
                module_number,
                day_number,
                title,
                story
            ) VALUES (
                v_new_plan_id,
                (v_module->>'module_number')::int,
                (v_quest->>'day')::int,
                (v_quest->>'title'),
                (v_quest->>'story')
            ) RETURNING id INTO v_new_quest_id;

            -- Insert Tasks for this Quest
            INSERT INTO public.tasks (
                quest_id,
                title,
                short_description,
                reward_coins
            )
            SELECT
                v_new_quest_id,
                t->>'title',
                t->>'short_description',
                COALESCE((t->>'reward')::int, 5)
            FROM jsonb_array_elements(v_quest->'tasks') t;
            
        END LOOP;
    END LOOP;

    -- Return the plan details to be sent back to the client
    RETURN v_plan_data;
END;
$$;


ALTER FUNCTION "public"."instantiate_journey_template"("p_template_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_pet_mission_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_pet_nickname text;
BEGIN
    -- Only notify when transitioning from 'ongoing' to 'completed' or 'failed'
    IF (OLD.status = 'ongoing' AND (NEW.status = 'completed' OR NEW.status = 'failed')) THEN
        SELECT nickname INTO v_pet_nickname FROM public.user_pets WHERE id = NEW.pet_id;
        
        INSERT INTO public.notifications (user_id, title, message, type, action_link)
        VALUES (
            NEW.user_id, 
            CASE WHEN NEW.status = 'completed' THEN 'Mission Successful!' ELSE 'Mission Failed' END,
            CASE WHEN NEW.status = 'completed' 
                 THEN COALESCE(v_pet_nickname, 'Your companion') || ' has returned with rewards!' 
                 ELSE COALESCE(v_pet_nickname, 'Your companion') || ' has returned empty-handed.' 
            END,
            CASE WHEN NEW.status = 'completed' THEN 'success' ELSE 'warning' END,
            '/pet'
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_pet_mission_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_pet_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Notify on Death
    IF (NEW.status = 'dead' AND (OLD.status IS NULL OR OLD.status = 'alive')) THEN
        INSERT INTO public.notifications (user_id, title, message, type, action_link)
        VALUES (NEW.user_id, 'Companion Fallen', 'Your companion has passed away. Visit the hub to revive them.', 'warning', '/pet');
    END IF;

    -- Notify on low health (Hungry)
    IF (NEW.health < 30 AND (OLD.health IS NULL OR OLD.health >= 30) AND NEW.status = 'alive') THEN
        INSERT INTO public.notifications (user_id, title, message, type, action_link)
        VALUES (NEW.user_id, 'Companion Hungry', 'Your companion is weak and needs food!', 'warning', '/pet');
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_pet_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_level_up"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_level int;
    v_xp int;
    v_threshold int;
    v_leveled_up boolean := false;
BEGIN
    SELECT level, xp INTO v_level, v_xp FROM public.profiles WHERE id = p_user_id;
    
    -- Loop to handle multiple level-ups at once (rare but possible with big rewards)
    LOOP
        v_threshold := public.get_xp_threshold(v_level);
        
        IF v_xp >= v_threshold THEN
            v_xp := v_xp - v_threshold;
            v_level := v_level + 1;
            v_leveled_up := true;
        ELSE
            EXIT; -- Break loop when XP is not enough for next level
        END IF;
    END LOOP;
    
    -- Only update if changed
    IF v_leveled_up THEN
        UPDATE public.profiles 
        SET level = v_level, xp = v_xp 
        WHERE id = p_user_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."process_level_up"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_item"("p_user_id" "uuid", "p_item_id" bigint) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  item_cost integer;
  user_coins integer;
BEGIN
    -- Security Check: Ensure the caller is operating on their own data
    IF (auth.role() = 'authenticated' AND auth.uid() != p_user_id) THEN
        RETURN 'Unauthorized: You can only purchase items for yourself.';
    END IF;

  -- Get item cost
  SELECT cost INTO item_cost FROM public.shop_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN 'Item not found.';
  END IF;

  -- Get user coins
  SELECT coins INTO user_coins FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN 'User profile not found.';
  END IF;

  -- Check if user has enough coins
  IF user_coins < item_cost THEN
    RETURN 'Insufficient coins.';
  END IF;

  -- Check if user already owns the item
  IF EXISTS (SELECT 1 FROM public.user_items WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN 'Item already owned.';
  END IF;

  -- Perform the transaction
  -- Trigger will allow this because function is SECURITY DEFINER (CURRENT_USER = postgres)
  UPDATE public.profiles
  SET coins = coins - item_cost
  WHERE id = p_user_id;

  INSERT INTO public.user_items (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  RETURN 'Purchase successful.';
END;
$$;


ALTER FUNCTION "public"."purchase_item"("p_user_id" "uuid", "p_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_pet_item"("p_user_id" "uuid", "p_pet_item_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_cost int;
    v_user_coins int;
BEGIN
    -- Security Check: Ensure the caller is operating on their own data
    -- We allow 'service_role' (server-side calls) to bypass this check if needed,
    -- but for web users ('authenticated'), they must match.
    IF (auth.role() = 'authenticated' AND auth.uid() != p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: You can only purchase items for yourself.';
    END IF;

    -- Get cost
    SELECT cost INTO v_cost FROM public.pet_items WHERE id = p_pet_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- Check coins
    SELECT coins INTO v_user_coins FROM public.profiles WHERE id = p_user_id;
    IF v_user_coins < v_cost THEN
        RAISE EXCEPTION 'Not enough coins.';
    END IF;

    -- Deduct coins
    -- Trigger will allow this because function is SECURITY DEFINER (CURRENT_USER = postgres)
    UPDATE public.profiles SET coins = coins - v_cost WHERE id = p_user_id;

    -- Add to inventory (upsert for quantity)
    INSERT INTO public.user_pet_inventory (user_id, pet_item_id, quantity)
    VALUES (p_user_id, p_pet_item_id, 1)
    ON CONFLICT (user_id, pet_item_id) 
    DO UPDATE SET quantity = user_pet_inventory.quantity + 1;
END;
$$;


ALTER FUNCTION "public"."purchase_pet_item"("p_user_id" "uuid", "p_pet_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_pet_item_internal"("p_user_id" "uuid", "p_pet_item_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Add to inventory (upsert for quantity)
    INSERT INTO public.user_pet_inventory (user_id, pet_item_id, quantity)
    VALUES (p_user_id, p_pet_item_id, 1)
    ON CONFLICT (user_id, pet_item_id) 
    DO UPDATE SET quantity = user_pet_inventory.quantity + 1;
END;
$$;


ALTER FUNCTION "public"."purchase_pet_item_internal"("p_user_id" "uuid", "p_pet_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revive_pet"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_pet_record RECORD;
    v_current_modules integer;
    v_modules_needed integer := 3;
    v_modules_done_since_death integer;
BEGIN
    SELECT * INTO v_pet_record FROM user_pets WHERE user_id = p_user_id AND status = 'dead';
    
    IF v_pet_record IS NULL THEN
        RAISE EXCEPTION 'No dead companion found.';
    END IF;

    -- Calculate current modules
    SELECT count(*) INTO v_current_modules 
    FROM quests q 
    JOIN plans p ON q.plan_id = p.id 
    WHERE p.user_id = p_user_id 
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0;

    -- Calculate progress
    v_modules_done_since_death := v_current_modules - v_pet_record.revival_progress;

    IF v_modules_done_since_death >= v_modules_needed THEN
        -- Revive!
        UPDATE user_pets 
        SET status = 'alive', health = 50, happiness = 50, revival_progress = 0 
        WHERE id = v_pet_record.id;
        RETURN 'success';
    ELSE
        RETURN format('progress:%s/%s', v_modules_done_since_death, v_modules_needed);
    END IF;
END;
$$;


ALTER FUNCTION "public"."revive_pet"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sell_item"("p_item_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_sell_price int;
    v_item_instance_id bigint;
BEGIN
    -- 1. Verify caller identity
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- 2. Verify ownership and get an instance ID
    SELECT id INTO v_item_instance_id 
    FROM public.user_items 
    WHERE user_id = v_user_id AND item_id = p_item_id 
    LIMIT 1;

    IF v_item_instance_id IS NULL THEN
        RAISE EXCEPTION 'You do not own this item.';
    END IF;

    -- 3. Get original cost
    SELECT cost INTO v_cost FROM public.shop_items WHERE id = p_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item price data not found.';
    END IF;
    
    v_sell_price := floor(v_cost / 2);

    -- 4. Delete the item instance
    DELETE FROM public.user_items WHERE id = v_item_instance_id;

    -- 5. Update coins (Bypassing RLS via SECURITY DEFINER)
    UPDATE public.profiles 
    SET coins = coins + v_sell_price 
    WHERE id = v_user_id;

    RETURN v_sell_price;
END;
$$;


ALTER FUNCTION "public"."sell_item"("p_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sell_pet_item"("p_pet_item_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_cost int;
    v_sell_price int;
    v_current_quantity int;
BEGIN
    -- 1. Verify caller identity
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- 2. Verify ownership and quantity
    SELECT quantity INTO v_current_quantity 
    FROM public.user_pet_inventory 
    WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    
    IF v_current_quantity IS NULL OR v_current_quantity < 1 THEN
        RAISE EXCEPTION 'You do not own this item.';
    END IF;

    -- 3. Get original cost
    SELECT cost INTO v_cost FROM public.pet_items WHERE id = p_pet_item_id;
    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'Item price data not found.';
    END IF;

    v_sell_price := floor(v_cost / 2);

    -- 4. Decrement or Delete
    IF v_current_quantity > 1 THEN
        UPDATE public.user_pet_inventory 
        SET quantity = quantity - 1 
        WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    ELSE
        DELETE FROM public.user_pet_inventory 
        WHERE user_id = v_user_id AND pet_item_id = p_pet_item_id;
    END IF;

    -- 5. Update coins (Bypassing RLS via SECURITY DEFINER)
    UPDATE public.profiles 
    SET coins = coins + v_sell_price 
    WHERE id = v_user_id;

    RETURN v_sell_price;
END;
$$;


ALTER FUNCTION "public"."sell_pet_item"("p_pet_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_completed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        NEW.completed_at = now();
    ELSIF NEW.is_completed = false THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_task_completed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."spend_pet_energy"("p_pet_id" "uuid", "p_amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_energy integer;
    v_new_energy integer;
BEGIN
    -- Calculate current actual energy including passive restoration
    v_current_energy := public.get_pet_energy(p_pet_id);
    
    IF v_current_energy < p_amount THEN
        RAISE EXCEPTION 'Not enough energy.';
    END IF;
    
    v_new_energy := v_current_energy - p_amount;
    
    -- Save the new baseline and reset the timer (Freezing it for the mission)
    UPDATE public.user_pets
    SET current_energy = v_new_energy,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;
END;
$$;


ALTER FUNCTION "public"."spend_pet_energy"("p_pet_id" "uuid", "p_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_pet_energy"("p_pet_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_calculated_energy integer;
BEGIN
    v_calculated_energy := public.get_pet_energy(p_pet_id);
    
    UPDATE public.user_pets
    SET current_energy = v_calculated_energy,
        last_energy_refill_at = now()
    WHERE id = p_pet_id;
    
    RETURN v_calculated_energy;
END;
$$;


ALTER FUNCTION "public"."sync_pet_energy"("p_pet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_activity"("p_timezone" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_last_login timestamptz;
    v_current_streak integer;
    v_longest_streak integer;
    
    v_now_utc timestamptz := now();
    v_today_local date;
    v_last_login_local date;
    v_yesterday_local date;
BEGIN
    SELECT last_login_at, current_streak, longest_streak 
    INTO v_last_login, v_current_streak, v_longest_streak
    FROM profiles
    WHERE id = v_user_id;

    UPDATE profiles SET timezone = p_timezone WHERE id = v_user_id;

    v_today_local := date(v_now_utc AT TIME ZONE p_timezone);
    v_last_login_local := date(v_last_login AT TIME ZONE p_timezone);
    v_yesterday_local := v_today_local - integer '1';

    -- Streak Logic
    IF v_current_streak = 0 THEN
        v_current_streak := 1;
        UPDATE profiles SET current_streak = 1, last_login_at = v_now_utc WHERE id = v_user_id;
    ELSIF v_last_login_local = v_today_local THEN
        NULL; -- Already processed today
    ELSIF v_last_login_local = v_yesterday_local THEN
        v_current_streak := v_current_streak + 1;
        IF v_current_streak > v_longest_streak THEN
            v_longest_streak := v_current_streak;
        END IF;
        UPDATE profiles SET current_streak = v_current_streak, longest_streak = v_longest_streak, last_login_at = v_now_utc WHERE id = v_user_id;
        PERFORM check_achievements(v_user_id);
        
        -- Decay Pet Stats (Only once per day)
        PERFORM public.decay_pet_stats(v_user_id);
        
    ELSE
        -- Missed a day
        v_current_streak := 1;
        UPDATE profiles SET current_streak = 1, last_login_at = v_now_utc WHERE id = v_user_id;
        
        -- Decay Pet Stats (Multiplied by missed days? For now just once to be kind, or maybe harsher?)
        -- Let's just decay once per login event to avoid killing it instantly after a vacation.
        PERFORM public.decay_pet_stats(v_user_id);
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_activity"("p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_consumable_item"("p_user_item_id" bigint) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_name text;
  v_deleted_count int;
BEGIN
  -- Get item info
  SELECT s.name INTO v_item_name
  FROM public.user_items ui
  JOIN public.shop_items s ON ui.item_id = s.id
  WHERE ui.id = p_user_item_id AND ui.user_id = v_user_id;       

  IF v_item_name IS NULL THEN
    RAISE EXCEPTION 'Item not found or you do not own it.';      
  END IF;

  -- Atomic Delete
  WITH deleted AS (
    DELETE FROM public.user_items
    WHERE id = p_user_item_id AND user_id = v_user_id
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Item already used.';
  END IF;

  RETURN 'Used ' || v_item_name;
END;
$$;


ALTER FUNCTION "public"."use_consumable_item"("p_user_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_pet_item"("p_pet_item_id" bigint) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_effect_health int;
    v_effect_happiness int;
    v_is_refill boolean;
    v_pet_species text[];
    v_pet_id uuid;
    v_pet_def_id text;
    v_current_quantity int;
BEGIN
    -- Get active pet first to check missions
    SELECT id, pet_def_id 
    INTO v_pet_id, v_pet_def_id
    FROM user_pets 
    WHERE user_id = v_user_id AND status = 'alive' 
    LIMIT 1;
    
    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion.';
    END IF;

    -- 1. Check if on mission
    IF EXISTS (
        SELECT 1 FROM public.pet_missions 
        WHERE pet_id = v_pet_id AND status = 'ongoing'
    ) THEN
        RAISE EXCEPTION 'Your companion is currently away on a mission.';
    END IF;

    -- 2. Get item details and verify ownership
    SELECT 
        pi.name, 
        pi.effect_health, 
        pi.effect_happiness, 
        pi.is_full_energy_refill,
        pi.pet_species,
        upi.quantity
    INTO 
        v_item_name, 
        v_effect_health, 
        v_effect_happiness, 
        v_is_refill,
        v_pet_species,
        v_current_quantity
    FROM user_pet_inventory upi
    JOIN pet_items pi ON upi.pet_item_id = pi.id
    WHERE upi.pet_item_id = p_pet_item_id AND upi.user_id = v_user_id;

    IF v_item_name IS NULL OR v_current_quantity < 1 THEN
        RAISE EXCEPTION 'Item not found in inventory.';
    END IF;

    -- 3. Species Check
    IF v_pet_species IS NOT NULL AND NOT (v_pet_def_id = ANY(v_pet_species)) THEN
        RAISE EXCEPTION 'This item cannot be used on this type of companion.';
    END IF;

    -- 4. Apply Effects
    IF v_is_refill = true THEN
        UPDATE user_pets 
        SET 
            current_energy = 100,
            last_energy_refill_at = now()
        WHERE id = v_pet_id;
    ELSE
        UPDATE user_pets 
        SET 
            health = LEAST(100, GREATEST(0, health + v_effect_health)), 
            happiness = LEAST(100, GREATEST(0, happiness + v_effect_happiness)) 
        WHERE id = v_pet_id;
    END IF;

    -- 5. Consume 1 from quantity
    IF v_current_quantity > 1 THEN
        UPDATE user_pet_inventory SET quantity = quantity - 1 WHERE pet_item_id = p_pet_item_id AND user_id = v_user_id;
    ELSE
        DELETE FROM user_pet_inventory WHERE pet_item_id = p_pet_item_id AND user_id = v_user_id;
    END IF;

    RETURN 'Used ' || v_item_name;
END;
$$;


ALTER FUNCTION "public"."use_pet_item"("p_pet_item_id" bigint) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."achievements" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "reward_xp" integer DEFAULT 0,
    "reward_coins" integer DEFAULT 0,
    "icon_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."achievements" OWNER TO "postgres";


ALTER TABLE "public"."achievements" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."achievements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."adventure_chat_history" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "adventure_chat_history_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."adventure_chat_history" OWNER TO "postgres";


ALTER TABLE "public"."adventure_chat_history" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."adventure_chat_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."adventure_states" (
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "theme" "text",
    "win_condition" "text",
    "reward_summary" "text",
    "inventory_snapshot" "jsonb",
    "stats_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locations" "jsonb",
    "enemies" "jsonb",
    "puzzles" "jsonb",
    "dungeon_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."adventure_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boss_fights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" bigint NOT NULL,
    "module_number" integer NOT NULL,
    "boss_type" "text" NOT NULL,
    "boss_model_path" "text" NOT NULL,
    "story_plot" "text",
    "questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "player_hp" integer DEFAULT 100 NOT NULL,
    "boss_hp" integer DEFAULT 100 NOT NULL,
    "status" "public"."boss_fight_status" DEFAULT 'active'::"public"."boss_fight_status" NOT NULL,
    "cooldown_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "explanation" "text"
);


ALTER TABLE "public"."boss_fights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_history" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_history_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_history" OWNER TO "postgres";


ALTER TABLE "public"."chat_history" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."chat_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."equipped_items" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" bigint NOT NULL,
    "slot" "text" NOT NULL,
    "equipped_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."equipped_items" OWNER TO "postgres";


ALTER TABLE "public"."equipped_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."equipped_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."journey_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" DEFAULT 'Custom'::"text",
    "title" "text" NOT NULL,
    "description" "text",
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."journey_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "action_link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


ALTER TABLE "public"."notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pet_definitions" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "model_path" "text" NOT NULL
);


ALTER TABLE "public"."pet_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_items" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "cost" integer DEFAULT 0 NOT NULL,
    "asset_url" "text",
    "pet_species" "text"[],
    "item_tier" integer DEFAULT 1,
    "effect_health" integer DEFAULT 0,
    "effect_happiness" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "show_in_shop" boolean DEFAULT true NOT NULL,
    "is_full_energy_refill" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."pet_items" OWNER TO "postgres";


ALTER TABLE "public"."pet_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pet_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pet_missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "difficulty" "public"."mission_difficulty" NOT NULL,
    "status" "public"."mission_status" DEFAULT 'ongoing'::"public"."mission_status" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_seconds" integer NOT NULL,
    "mission_title" "text",
    "story_plot" "text",
    "success_story" "text",
    "failure_story" "text",
    "gold_reward" integer DEFAULT 0,
    "xp_reward" integer DEFAULT 0,
    "items_awarded" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."pet_missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_text" "text",
    "total_estimated_days" bigint,
    "total_estimated_modules" bigint,
    "complexity" "text" DEFAULT 'simple'::"text" NOT NULL,
    "total_estimated_duration_weeks" integer DEFAULT 0 NOT NULL,
    "plan_details" "jsonb",
    "plot" "text",
    "is_reward_claimed" boolean DEFAULT false
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."plans" IS 'Stores quests for each user';



ALTER TABLE "public"."plans" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."processed_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."processed_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "coins" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "onboarding_completed" boolean DEFAULT false,
    "full_name" "text",
    "age" integer,
    "last_plan_generated_at" timestamp with time zone,
    "last_oracle_chat_at" timestamp with time zone,
    "character_model_path" "text",
    "has_had_trial" boolean DEFAULT false NOT NULL,
    "plan_generations_count" integer DEFAULT 0 NOT NULL,
    "plan_generations_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "oracle_messages_count" integer DEFAULT 0 NOT NULL,
    "oracle_messages_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "purchased_plan_credits" integer DEFAULT 0 NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text",
    "last_login_at" timestamp with time zone DEFAULT "now"(),
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "action_points" integer DEFAULT 15 NOT NULL,
    "dungeon_keys" integer DEFAULT 0 NOT NULL,
    "date_of_birth" "date",
    "gender" "text",
    "onboarding_goal" "text",
    "referral_source" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quests" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" bigint,
    "module_number" bigint,
    "day_number" bigint,
    "title" "text",
    "status" "text" DEFAULT '''pending'''::"text",
    "story" "text"
);


ALTER TABLE "public"."quests" OWNER TO "postgres";


COMMENT ON TABLE "public"."quests" IS 'Stores individual daily quests per user';



ALTER TABLE "public"."quests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."quests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shop_items" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "cost" integer NOT NULL,
    "asset_url" "text",
    "slot" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" bigint,
    "stat_buffs" "jsonb",
    "type" "text" DEFAULT 'equippable'::"text",
    "source" "text" DEFAULT 'shop'::"text" NOT NULL
);


ALTER TABLE "public"."shop_items" OWNER TO "postgres";


ALTER TABLE "public"."shop_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."shop_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "renews_at" timestamp with time zone,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "stripe_current_period_end" timestamp with time zone,
    "status" "text"
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" bigint NOT NULL,
    "quest_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "reward_coins" integer DEFAULT 5 NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "short_description" "text",
    "completed_at" timestamp with time zone,
    "is_rewarded" boolean DEFAULT false
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


ALTER TABLE "public"."tasks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tasks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_id" bigint NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


ALTER TABLE "public"."user_achievements" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_achievements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_items" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_items" OWNER TO "postgres";


ALTER TABLE "public"."user_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_pet_inventory" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pet_item_id" bigint NOT NULL,
    "quantity" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quantity_non_negative" CHECK (("quantity" >= 0))
);


ALTER TABLE "public"."user_pet_inventory" OWNER TO "postgres";


ALTER TABLE "public"."user_pet_inventory" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_pet_inventory_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pet_def_id" "text" NOT NULL,
    "nickname" "text",
    "health" integer DEFAULT 100,
    "happiness" integer DEFAULT 100,
    "status" "text" DEFAULT 'alive'::"text",
    "unlocked_at" timestamp with time zone DEFAULT "now"(),
    "last_fed_at" timestamp with time zone DEFAULT "now"(),
    "revival_progress" integer DEFAULT 0,
    "level" integer DEFAULT 1 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "last_energy_refill_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_energy" integer DEFAULT 100 NOT NULL
);


ALTER TABLE "public"."user_pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "value" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


ALTER TABLE "public"."user_stats" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_stats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."achievements"
    ADD CONSTRAINT "achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adventure_chat_history"
    ADD CONSTRAINT "adventure_chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adventure_states"
    ADD CONSTRAINT "adventure_states_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_user_id_plan_id_module_number_key" UNIQUE ("user_id", "plan_id", "module_number");



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipped_items"
    ADD CONSTRAINT "equipped_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipped_items"
    ADD CONSTRAINT "equipped_items_user_id_slot_key" UNIQUE ("user_id", "slot");



ALTER TABLE ONLY "public"."journey_templates"
    ADD CONSTRAINT "journey_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_definitions"
    ADD CONSTRAINT "pet_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_items"
    ADD CONSTRAINT "pet_items_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."pet_items"
    ADD CONSTRAINT "pet_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_missions"
    ADD CONSTRAINT "pet_missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_webhook_events"
    ADD CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_webhook_events"
    ADD CONSTRAINT "processed_webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_items"
    ADD CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_items"
    ADD CONSTRAINT "user_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_items"
    ADD CONSTRAINT "user_items_user_id_item_id_key" UNIQUE ("user_id", "item_id");



ALTER TABLE ONLY "public"."user_pet_inventory"
    ADD CONSTRAINT "user_pet_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_pet_inventory"
    ADD CONSTRAINT "user_pet_inventory_user_id_pet_item_id_key" UNIQUE ("user_id", "pet_item_id");



ALTER TABLE ONLY "public"."user_pets"
    ADD CONSTRAINT "user_pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_pets"
    ADD CONSTRAINT "user_pets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_boss_fights_lookup" ON "public"."boss_fights" USING "btree" ("user_id", "plan_id", "module_number");



CREATE INDEX "idx_profiles_current_streak" ON "public"."profiles" USING "btree" ("current_streak" DESC);



CREATE INDEX "idx_profiles_has_had_trial" ON "public"."profiles" USING "btree" ("has_had_trial");



CREATE INDEX "idx_profiles_xp" ON "public"."profiles" USING "btree" ("xp" DESC);



CREATE INDEX "idx_quests_plan_id" ON "public"."quests" USING "btree" ("plan_id");



CREATE INDEX "idx_shop_items_plan_id" ON "public"."shop_items" USING "btree" ("plan_id");



CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_stripe_subscription_id" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_tasks_quest_id" ON "public"."tasks" USING "btree" ("quest_id");



CREATE INDEX "idx_user_items_item_id" ON "public"."user_items" USING "btree" ("item_id");



CREATE INDEX "idx_user_pets_pet_def_id" ON "public"."user_pets" USING "btree" ("pet_def_id");



CREATE INDEX "idx_user_stats_plan_id" ON "public"."user_stats" USING "btree" ("plan_id");



CREATE UNIQUE INDEX "journey_templates_title_key" ON "public"."journey_templates" USING "btree" ("title");



CREATE INDEX "notifications_unread_idx" ON "public"."notifications" USING "btree" ("user_id") WHERE ("is_read" = false);



CREATE INDEX "notifications_user_id_idx" ON "public"."notifications" USING "btree" ("user_id");



CREATE UNIQUE INDEX "unique_active_dungeon_per_user" ON "public"."adventure_states" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE OR REPLACE TRIGGER "on_subscription_reward" AFTER INSERT OR UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_subscription_key_awards"();



CREATE OR REPLACE TRIGGER "protect_profile_stats" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."check_profile_update_permissions"();



CREATE OR REPLACE TRIGGER "protect_task_rewards" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."check_task_update_permissions"();



CREATE OR REPLACE TRIGGER "tr_pet_mission_notifications" AFTER UPDATE ON "public"."pet_missions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_pet_mission_completion"();



CREATE OR REPLACE TRIGGER "tr_pet_notifications" AFTER UPDATE ON "public"."user_pets" FOR EACH ROW EXECUTE FUNCTION "public"."notify_pet_status"();



CREATE OR REPLACE TRIGGER "trigger_handle_task_rewards" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_task_rewards"();



CREATE OR REPLACE TRIGGER "trigger_set_task_completed_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_completed_at"();



CREATE OR REPLACE TRIGGER "verify_ownership_before_equip" BEFORE INSERT OR UPDATE ON "public"."equipped_items" FOR EACH ROW EXECUTE FUNCTION "public"."check_item_ownership"();



ALTER TABLE ONLY "public"."adventure_chat_history"
    ADD CONSTRAINT "adventure_chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adventure_states"
    ADD CONSTRAINT "adventure_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boss_fights"
    ADD CONSTRAINT "boss_fights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_history"
    ADD CONSTRAINT "chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipped_items"
    ADD CONSTRAINT "equipped_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipped_items"
    ADD CONSTRAINT "equipped_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_missions"
    ADD CONSTRAINT "pet_missions_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."user_pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_missions"
    ADD CONSTRAINT "pet_missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quests"
    ADD CONSTRAINT "quests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_items"
    ADD CONSTRAINT "shop_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_items"
    ADD CONSTRAINT "user_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_items"
    ADD CONSTRAINT "user_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pet_inventory"
    ADD CONSTRAINT "user_pet_inventory_pet_item_id_fkey" FOREIGN KEY ("pet_item_id") REFERENCES "public"."pet_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pet_inventory"
    ADD CONSTRAINT "user_pet_inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pets"
    ADD CONSTRAINT "user_pets_pet_def_id_fkey" FOREIGN KEY ("pet_def_id") REFERENCES "public"."pet_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pets"
    ADD CONSTRAINT "user_pets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow users to read their own subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Everyone can read pet definitions" ON "public"."pet_definitions" FOR SELECT USING (true);



CREATE POLICY "Everyone can read pet items" ON "public"."pet_items" FOR SELECT USING (true);



CREATE POLICY "Everyone can view achievements" ON "public"."achievements" FOR SELECT USING (true);



CREATE POLICY "Service role can manage templates." ON "public"."journey_templates" USING (false);



CREATE POLICY "Service role only" ON "public"."processed_webhook_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Shop items are viewable by everyone." ON "public"."shop_items" FOR SELECT USING (true);



CREATE POLICY "Templates are viewable by everyone." ON "public"."journey_templates" FOR SELECT USING (true);



CREATE POLICY "Users can create their own boss fights" ON "public"."boss_fights" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own adventure chat history." ON "public"."adventure_chat_history" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own chat history." ON "public"."chat_history" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own equipped items." ON "public"."equipped_items" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own notifications." ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own adventure chat history." ON "public"."adventure_chat_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own chat history." ON "public"."chat_history" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own equipped items." ON "public"."equipped_items" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own pet missions" ON "public"."pet_missions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own pets" ON "public"."user_pets" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert/update their own adventure state." ON "public"."adventure_states" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update (mark read) their own notifications." ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own boss fights" ON "public"."boss_fights" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own equipped items." ON "public"."equipped_items" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own pet inventory" ON "public"."user_pet_inventory" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own pet missions" ON "public"."pet_missions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pets" ON "public"."user_pets" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own profile." ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own quests" ON "public"."quests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."plans"
  WHERE (("plans"."id" = "quests"."plan_id") AND ("plans"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."quests"
     JOIN "public"."plans" ON (("quests"."plan_id" = "plans"."id")))
  WHERE (("quests"."id" = "tasks"."quest_id") AND ("plans"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view quests for their own plans" ON "public"."quests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."plans"
  WHERE (("plans"."id" = "quests"."plan_id") AND ("plans"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view tasks for their own quests" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."quests"
     JOIN "public"."plans" ON (("quests"."plan_id" = "plans"."id")))
  WHERE (("quests"."id" = "tasks"."quest_id") AND ("plans"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view their own adventure chat history." ON "public"."adventure_chat_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own adventure state." ON "public"."adventure_states" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own boss fights" ON "public"."boss_fights" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own chat history." ON "public"."chat_history" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own equipped items." ON "public"."equipped_items" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own inventory." ON "public"."user_items" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own notifications." ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pet inventory" ON "public"."user_pet_inventory" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own pet missions" ON "public"."pet_missions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pets" ON "public"."user_pets" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view their own plans." ON "public"."plans" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own profile." ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own stats." ON "public"."user_stats" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own unlocked achievements" ON "public"."user_achievements" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adventure_chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adventure_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boss_fights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipped_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journey_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_pet_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_stats" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































REVOKE ALL ON FUNCTION "public"."add_coins"("user_id_input" "uuid", "amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_coins"("user_id_input" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_dungeon_keys"("p_user_id" "uuid", "p_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_dungeon_keys"("p_user_id" "uuid", "p_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_dungeon_keys"("p_user_id" "uuid", "p_amount" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_rewards"("user_id_input" "uuid", "coin_amount" integer, "xp_amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rewards"("user_id_input" "uuid", "coin_amount" integer, "xp_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."adopt_pet"("p_pet_def_id" "text", "p_nickname" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."adopt_pet"("p_pet_def_id" "text", "p_nickname" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adopt_pet"("p_pet_def_id" "text", "p_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."award_achievement"("p_user_id" "uuid", "p_achievement_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."award_achievement"("p_user_id" "uuid", "p_achievement_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_achievement"("p_user_id" "uuid", "p_achievement_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_plan_completion_reward"("p_user_id" "uuid", "p_plan_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_achievements"("user_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_achievements"("user_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_achievements"("user_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_item_ownership"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_item_ownership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_item_ownership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_profile_update_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_profile_update_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_profile_update_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_task_update_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_task_update_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_task_update_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decay_pet_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decay_pet_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decay_pet_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enter_dungeon"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."enter_dungeon"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enter_dungeon"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_leaderboard"("sort_by" "text", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_leaderboard"("sort_by" "text", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_leaderboard"("sort_by" "text", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pet_energy"("p_pet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pet_energy"("p_pet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pet_energy"("p_pet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_xp_threshold"("p_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_xp_threshold"("p_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_xp_threshold"("p_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_subscription_key_awards"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_key_awards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_key_awards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_task_rewards"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_task_rewards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_task_rewards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."heal_pet_on_task"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."heal_pet_on_task"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."heal_pet_on_task"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."heartbeat_pet_energy"("p_pet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."heartbeat_pet_energy"("p_pet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."heartbeat_pet_energy"("p_pet_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_plan_credits"("user_id_input" "uuid", "amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_plan_credits"("user_id_input" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_profile_coins"("p_user_id" "uuid", "p_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_profile_coins"("p_user_id" "uuid", "p_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_profile_coins"("p_user_id" "uuid", "p_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."instantiate_journey_template"("p_template_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."instantiate_journey_template"("p_template_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."instantiate_journey_template"("p_template_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_pet_mission_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_pet_mission_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_pet_mission_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_pet_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_pet_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_pet_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_level_up"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_level_up"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_level_up"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."purchase_item"("p_user_id" "uuid", "p_item_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purchase_item"("p_user_id" "uuid", "p_item_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."purchase_item"("p_user_id" "uuid", "p_item_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."purchase_pet_item"("p_user_id" "uuid", "p_pet_item_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purchase_pet_item"("p_user_id" "uuid", "p_pet_item_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."purchase_pet_item"("p_user_id" "uuid", "p_pet_item_id" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."purchase_pet_item_internal"("p_user_id" "uuid", "p_pet_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_pet_item_internal"("p_user_id" "uuid", "p_pet_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_pet_item_internal"("p_user_id" "uuid", "p_pet_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."revive_pet"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revive_pet"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revive_pet"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sell_item"("p_item_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sell_item"("p_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."sell_item"("p_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sell_item"("p_item_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sell_pet_item"("p_pet_item_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sell_pet_item"("p_pet_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."sell_pet_item"("p_pet_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sell_pet_item"("p_pet_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_completed_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_completed_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_completed_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."spend_pet_energy"("p_pet_id" "uuid", "p_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."spend_pet_energy"("p_pet_id" "uuid", "p_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."spend_pet_energy"("p_pet_id" "uuid", "p_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_pet_energy"("p_pet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_pet_energy"("p_pet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_pet_energy"("p_pet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_activity"("p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_activity"("p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_activity"("p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."use_consumable_item"("p_user_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."use_consumable_item"("p_user_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_consumable_item"("p_user_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."use_pet_item"("p_pet_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."use_pet_item"("p_pet_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_pet_item"("p_pet_item_id" bigint) TO "service_role";
























GRANT ALL ON TABLE "public"."achievements" TO "anon";
GRANT ALL ON TABLE "public"."achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."achievements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."achievements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."achievements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."achievements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."adventure_chat_history" TO "anon";
GRANT ALL ON TABLE "public"."adventure_chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."adventure_chat_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."adventure_chat_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."adventure_chat_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."adventure_chat_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."adventure_states" TO "anon";
GRANT ALL ON TABLE "public"."adventure_states" TO "authenticated";
GRANT ALL ON TABLE "public"."adventure_states" TO "service_role";



GRANT ALL ON TABLE "public"."boss_fights" TO "anon";
GRANT ALL ON TABLE "public"."boss_fights" TO "authenticated";
GRANT ALL ON TABLE "public"."boss_fights" TO "service_role";



GRANT ALL ON TABLE "public"."chat_history" TO "anon";
GRANT ALL ON TABLE "public"."chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chat_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equipped_items" TO "anon";
GRANT ALL ON TABLE "public"."equipped_items" TO "authenticated";
GRANT ALL ON TABLE "public"."equipped_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipped_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipped_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipped_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."journey_templates" TO "anon";
GRANT ALL ON TABLE "public"."journey_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."journey_templates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pet_definitions" TO "anon";
GRANT ALL ON TABLE "public"."pet_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."pet_items" TO "anon";
GRANT ALL ON TABLE "public"."pet_items" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pet_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pet_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pet_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pet_missions" TO "anon";
GRANT ALL ON TABLE "public"."pet_missions" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_missions" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."processed_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."processed_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quests" TO "anon";
GRANT ALL ON TABLE "public"."quests" TO "authenticated";
GRANT ALL ON TABLE "public"."quests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shop_items" TO "anon";
GRANT ALL ON TABLE "public"."shop_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shop_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shop_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shop_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_achievements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_achievements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_achievements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_items" TO "anon";
GRANT ALL ON TABLE "public"."user_items" TO "authenticated";
GRANT ALL ON TABLE "public"."user_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_pet_inventory" TO "anon";
GRANT ALL ON TABLE "public"."user_pet_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pet_inventory" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_pet_inventory_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_pet_inventory_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_pet_inventory_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_pets" TO "anon";
GRANT ALL ON TABLE "public"."user_pets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pets" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_stats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_stats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_stats_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































