-- Optimize instantiate_journey_template to use bulk inserts instead of loops
CREATE OR REPLACE FUNCTION public.instantiate_journey_template(
    p_template_id uuid,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_content jsonb;
    v_plan_data jsonb;
    v_stats_data jsonb;
    v_shop_items_data jsonb;
    v_new_plan_id bigint;
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
        COALESCE((v_plan_data->>'total_estimated_duration_weeks')::numeric::int, 0),
        jsonb_array_length(v_plan_data->'modules'),
        (v_plan_data->>'plot'),
        v_plan_data
    ) RETURNING id INTO v_new_plan_id;

    -- 2. Insert Stats (Bulk)
    IF v_stats_data IS NOT NULL AND jsonb_array_length(v_stats_data) > 0 THEN
        INSERT INTO public.user_stats (user_id, plan_id, name, value)
        SELECT 
            p_user_id, 
            v_new_plan_id, 
            x->>'name', 
            (x->>'value')::numeric::int
        FROM jsonb_array_elements(v_stats_data) x;
    END IF;

    -- 3. Insert Shop Items (Bulk)
    IF v_shop_items_data IS NOT NULL AND jsonb_array_length(v_shop_items_data) > 0 THEN
        INSERT INTO public.shop_items (plan_id, name, description, cost, asset_url, slot, type, stat_buffs)
        SELECT 
            v_new_plan_id, 
            x->>'name', 
            x->>'description', 
            COALESCE((x->>'cost')::numeric::int, 0), 
            x->>'asset_url', 
            x->>'slot',
            COALESCE(x->>'type', 'equippable'),
            x->'stat_buffs'
        FROM jsonb_array_elements(v_shop_items_data) x;
    END IF;

    -- 4. Insert Quests and Tasks (Bulk using CTE)
    -- We filter for modules that actually HAVE daily_quests to avoid inserting NULLs
    WITH module_quests AS (
        SELECT 
            (m->>'module_number')::numeric::int as mod_num,
            COALESCE((q->>'day')::numeric::int, (q->>'day_number')::numeric::int) as day_num,
            q->>'title' as q_title,
            q->>'story' as q_story,
            q->'tasks' as q_tasks
        FROM jsonb_array_elements(v_plan_data->'modules') m,
             jsonb_array_elements(m->'daily_quests') q
    ),
    inserted_quests AS (
        INSERT INTO public.quests (
            plan_id,
            module_number,
            day_number,
            title,
            story
        )
        SELECT
            v_new_plan_id,
            mod_num,
            day_num,
            q_title,
            q_story
        FROM module_quests
        RETURNING id, module_number, day_number
    )
    INSERT INTO public.tasks (
        quest_id,
        title,
        short_description,
        reward_coins
    )
    SELECT
        iq.id,
        t->>'title',
        t->>'short_description',
        COALESCE((t->>'reward')::numeric::int, 5) -- Robust casting
    FROM module_quests mq,
         jsonb_array_elements(mq.q_tasks) t,
         inserted_quests iq
    WHERE mq.mod_num = iq.module_number
      AND mq.day_num = iq.day_number;

    RETURN v_plan_data;
EXCEPTION WHEN OTHERS THEN
    -- Capture detail of the error
    RAISE EXCEPTION 'Failed to instantiate plan: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;
