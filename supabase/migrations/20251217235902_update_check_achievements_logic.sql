CREATE OR REPLACE FUNCTION public.check_achievements(user_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
        ELSIF r_achievement.code = 'questsmith' AND v_achievements_unlocked >= 25 THEN
             PERFORM award_achievement(user_id_input, r_achievement.id);

        END IF;
    END LOOP;
END;
$$;
