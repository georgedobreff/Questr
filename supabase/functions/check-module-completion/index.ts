import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan_id, module_number }: { plan_id: number, module_number: number } = await req.json();

    const userSupabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: planOwnership, error: ownershipError } = await supabaseAdmin
      .from('plans')
      .select('user_id')
      .eq('id', plan_id)
      .single();

    if (ownershipError || !planOwnership) throw new Error('Plan not found');
    if (planOwnership.user_id !== user.id) throw new Error('Unauthorized access to this plan');

    const { data: currentQuests, error: currentQuestsError } = await supabaseAdmin
      .from('quests')
      .select('id')
      .eq('plan_id', plan_id)
      .eq('module_number', module_number);

    if (currentQuestsError) throw new Error(`Error fetching current quests: ${currentQuestsError.message}`);
    if (!currentQuests || currentQuests.length === 0) {
      return new Response(JSON.stringify({ message: 'No quests found for this module.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const currentQuestIds = currentQuests.map((q: { id: number }) => q.id);

    const { data: incompleteTasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .in('quest_id', currentQuestIds)
      .eq('is_completed', false)
      .limit(1);

    if (tasksError) throw new Error(`Error fetching tasks: ${tasksError.message}`);

    const allTasksCompleted = incompleteTasks.length === 0;

    if (allTasksCompleted) {
      interface PlanProgress {
        complexity: string;
        user_id: string;
        total_estimated_modules: number;
      }

      const { data: planData, error: planError } = await supabaseAdmin
        .from('plans')
        .select('complexity, user_id, total_estimated_modules')
        .eq('id', plan_id)
        .single();

      if (planError) throw new Error(`Error fetching plan details: ${planError.message}`);
      const typedPlanData = planData as PlanProgress;

      if (module_number >= typedPlanData.total_estimated_modules) {
        return new Response(JSON.stringify({ message: 'PLAN_COMPLETED' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (typedPlanData.complexity === 'complex') {
        interface SubscriptionData {
          status: string;
        }

        const { data: subData, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('status')
          .eq('user_id', typedPlanData.user_id)
          .maybeSingle();

        if (subError) throw new Error(`Error fetching subscription: ${subError.message}`);
        const typedSubData = subData as SubscriptionData | null;

        if (!typedSubData || (typedSubData.status !== 'active' && typedSubData.status !== 'pro')) {
          return new Response(JSON.stringify({
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Active subscription required to continue this path.'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const nextModuleNumber = module_number + 1;

      const { data: nextQuests, error: nextQuestsError } = await supabaseAdmin
        .from('quests')
        .select('id')
        .eq('plan_id', plan_id)
        .eq('module_number', nextModuleNumber)
        .limit(1);

      if (nextQuestsError) throw new Error(`Error checking for next module quests: ${nextQuestsError.message}`);

      if (nextQuests.length === 0) {
        console.log(`Module ${module_number} complete. Generating module ${nextModuleNumber} for plan ${plan_id}.`);

        const userSupabaseClient = createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { error: invokeError } = await userSupabaseClient.functions.invoke('continue-plan', {
          body: { plan_id: plan_id, module_to_generate: nextModuleNumber },
        });

        if (invokeError) throw new Error(`Error invoking continue-plan function: ${invokeError.message}`);

        return new Response(JSON.stringify({ message: 'Module completed. Next module generated.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({ message: 'Module complete, next module already exists.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ message: 'Module not yet complete.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Error in check-module-completion: ${error.message}`);
    return new Response(JSON.stringify({ error: 'Internal Server Error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
