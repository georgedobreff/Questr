-- 1. Add journey_template_id to plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS journey_template_id uuid REFERENCES public.journey_templates(id);

-- 2. Update the RPC to link the new plan to the template
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

    -- 1. Insert Plan (WITH TEMPLATE ID)
    INSERT INTO public.plans (
        user_id,
        goal_text,
        complexity,
        total_estimated_duration_weeks,
        total_estimated_modules,
        plot,
        plan_details,
        journey_template_id -- New Field
    ) VALUES (
        p_user_id,
        (v_plan_data->>'goal_title'),
        'pro', 
        (v_plan_data->>'total_estimated_duration_weeks')::int,
        jsonb_array_length(v_plan_data->'modules'),
        (v_plan_data->>'plot'),
        v_plan_data,
        p_template_id -- Link to Template
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
