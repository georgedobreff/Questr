import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    const userSupabaseClient = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized: No user found.');

    const { data: plan, error: findError } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
    if (findError) throw new Error(`Finding plan failed: ${findError.message}`);


    if (plan) {
      console.log(`Abandoning all progress for user ${user.id} and plan ${plan.id}`);

      const { data: quests, error: questsError } = await supabaseAdmin
        .from('quests')
        .select('id')
        .eq('plan_id', plan.id);
      if (questsError) throw new Error(`Fetching quests failed: ${questsError.message}`);

      if (quests && quests.length > 0) {
        const questIds = quests.map((q: { id: number }) => q.id);

        console.log(`Deleting tasks for ${questIds.length} quests...`);
        const { error: tasksError } = await supabaseAdmin
          .from('tasks')
          .delete()
          .in('quest_id', questIds);
        if (tasksError) throw new Error(`Deleting tasks failed: ${tasksError.message}`);
      }
      
      console.log(`Deleting stats for plan ${plan.id}...`);
      const { error: statsError } = await supabaseAdmin
        .from('user_stats')
        .delete()
        .eq('plan_id', plan.id);
      if (statsError) throw new Error(`Deleting stats failed: ${statsError.message}`);

      console.log(`Deleting quests for plan ${plan.id}...`);
      const { error: deleteQuestsError } = await supabaseAdmin
        .from('quests')
        .delete()
        .eq('plan_id', plan.id);
      if (deleteQuestsError) throw new Error(`Deleting quests failed: ${deleteQuestsError.message}`);
      
      console.log(`Deleting plan ${plan.id}...`);
      const { error: deletePlanError } = await supabaseAdmin
        .from('plans')
        .delete()
        .eq('id', plan.id);
      if (deletePlanError) throw new Error(`Deleting plan failed: ${deletePlanError.message}`);
      console.log("Plan and its dependencies deleted successfully.");
    }


    console.log(`Resetting profile and inventory for user ${user.id}...`);
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ coins: 0, xp: 0, level: 1 })
      .eq('id', user.id);
    if (profileError) throw new Error(`Profile reset failed: ${profileError.message}`);

    await supabaseAdmin.from('user_items').delete().eq('user_id', user.id);
    await supabaseAdmin.from('equipped_items').delete().eq('user_id', user.id);
    
    console.log("Wiping Oracle chat history...");
    await supabaseAdmin.from('chat_history').delete().eq('user_id', user.id);
    await supabaseAdmin.from('adventure_chat_history').delete().eq('user_id', user.id);

    console.log("Profile and inventory reset successfully.");

    return new Response(JSON.stringify({ message: 'Previous Path and all progress have been abandoned.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
    
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: 'Internal Server Error: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
