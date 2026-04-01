import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { STORY_GENERATOR_PROMPT } from '../_shared/prompts.ts';
import { callGemini } from '../_shared/llm.ts';
import { MODEL_QUEST_STORY_GENERATION } from '../_shared/llm_config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan_id, quest_ids, historical_context, plot }: { plan_id: string, quest_ids: number[], historical_context: string, plot: string } = await req.json();

    if (!plan_id || !quest_ids || !Array.isArray(quest_ids) || historical_context === undefined || !plot) {
      return new Response(JSON.stringify({ error: 'plan_id, quest_ids, historical_context, and plot are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const userClient = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: plan, error: planError } = await userClient
        .from('plans')
        .select('id')
        .eq('id', plan_id)
        .single();

    if (planError || !plan) {
         return new Response(JSON.stringify({ error: 'Unauthorized or Plan not found' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: quests, error: questsError } = await supabaseAdmin
      .from('quests')
      .select('id, title')
      .in('id', quest_ids);

    if (questsError) throw new Error(`Failed to fetch quests: ${questsError.message}`);

    for (const quest of quests as { id: number, title: string }[]) {
      const prompt = STORY_GENERATOR_PROMPT
        .replace('{MAIN_PLOT}', plot)
        .replace('{PREVIOUS_STORY}', historical_context) 
        .replace('{CURRENT_QUEST_GOAL}', quest.title);

      interface StoryResponse { story: string }
      const result = await callGemini(prompt);
      const { story: newStory } = result as unknown as StoryResponse;

      if (newStory) {
        await supabaseAdmin
          .from('quests')
          .update({ story: newStory })
          .eq('id', quest.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Error in generate-quest-stories: ${error.message}`);
    return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});