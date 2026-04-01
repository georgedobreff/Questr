import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { task_id, plan_id }: { task_id?: number, plan_id?: number } = await req.json();

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    interface PlanData {
      id: number;
      user_id: string;
      total_estimated_modules: number;
      quests: { module_number: number }[];
    }

    interface TaskDetails {
      id: number;
      quest_id: number;
      quests: {
        id: number;
        plan_id: number;
        module_number: number;
        plans: {
          id: number;
          user_id: string;
          total_estimated_modules: number;
        };
      };
    }

    let plan: { id: number; user_id: string; total_estimated_modules: number };
    let latestModuleNumber: number;

    if (plan_id) {
      const { data: planData, error: planError } = await supabaseAdmin
        .from('plans')
        .select('id, user_id, total_estimated_modules, quests(module_number)')
        .eq('id', plan_id)
        .single();

      if (planError) throw new Error(`Plan not found: ${planError.message}`);
      const typedPlanData = planData as unknown as PlanData;
      if (typedPlanData.user_id !== user.id) throw new Error('User does not own this plan.');

      plan = {
        id: typedPlanData.id,
        user_id: typedPlanData.user_id,
        total_estimated_modules: typedPlanData.total_estimated_modules
      };
      latestModuleNumber = typedPlanData.quests?.reduce((max: number, q: { module_number: number }) => Math.max(max, q.module_number), 0) || 0;
    } else {
      const { data: taskDetails, error: taskError } = await supabaseAdmin
        .from('tasks')
        .select('id, quest_id, quests ( id, plan_id, module_number, plans (id, user_id, total_estimated_modules) )')
        .eq('id', task_id)
        .single();

      if (taskError) throw new Error(`Task not found: ${taskError.message}`);
      const typedTaskDetails = taskDetails as unknown as TaskDetails;
      if (typedTaskDetails.quests.plans.user_id !== user.id) throw new Error('User does not own this plan.');

      plan = typedTaskDetails.quests.plans;
      latestModuleNumber = typedTaskDetails.quests.module_number;
    }

    if (latestModuleNumber < plan.total_estimated_modules) {
      return new Response(JSON.stringify({ is_completed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { data: allQuests, error: questsError } = await supabaseAdmin
      .from('quests')
      .select('id')
      .eq('plan_id', plan.id);

    if (questsError) throw new Error(`Could not fetch quests for plan: ${questsError.message}`);

    const questIds = allQuests.map((q: { id: number }) => q.id);

    const { data: incompleteTasks, error: incompleteError } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .in('quest_id', questIds)
      .eq('is_completed', false)
      .limit(1);

    if (incompleteError) throw new Error(`Could not check task completion: ${incompleteError.message}`);

    if (incompleteTasks && incompleteTasks.length === 0) {
      const { error: rewardError } = await supabaseAdmin.rpc('award_plan_completion_reward', {
        p_user_id: user.id,
        p_plan_id: plan.id,
      });

      if (rewardError) {
        console.error("Failed to award plan completion reward:", rewardError);
      }

      return new Response(JSON.stringify({ is_completed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ is_completed: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
