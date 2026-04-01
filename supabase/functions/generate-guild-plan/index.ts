import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { CONTENT_MODERATION_PROMPT, PLAN_GENERATOR_PROMPT } from '../_shared/prompts.ts';
import { callGemini } from '../_shared/llm.ts';
import { sanitizeInput } from '../_shared/security.ts';
import {
  MODEL_CONTENT_MODERATION,
  MODEL_PLAN_GENERATION
} from '../_shared/llm_config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { goal_text, experience }: { goal_text: string, experience?: string } = await req.json();

    if (!goal_text || typeof goal_text !== 'string' || goal_text.length > 1000) {
      return new Response(JSON.stringify({ error: 'Goal text must be a string and under 1000 characters.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const sanitizedGoal = sanitizeInput(goal_text);

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const userSupabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    interface ModerationResponse { is_safe: boolean }
    const moderationResult = await callGemini(CONTENT_MODERATION_PROMPT.replace('{USER_GOAL_HERE}', sanitizedGoal), true, MODEL_CONTENT_MODERATION);
    const { is_safe } = moderationResult as unknown as ModerationResponse;
    if (!is_safe) {
      return new Response(JSON.stringify({ error: 'This goal has been deemed unsafe or inappropriate.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('last_plan_generated_at')
      .eq('id', user.id)
      .single();

    const now = new Date();
    const lastGenTime = profile?.last_plan_generated_at ? new Date(profile.last_plan_generated_at).getTime() : 0;
    const debounceTime = 60 * 1000;

    if (now.getTime() - lastGenTime < debounceTime) {
      return new Response(JSON.stringify({ error: "Please wait a minute before generating another quest." }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    await supabaseAdmin
      .from('profiles')
      .update({ last_plan_generated_at: now.toISOString() })
      .eq('id', user.id);


    console.log(`Generating new guild quest for "${sanitizedGoal}"`);

    const textEncoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const timer = setInterval(() => {
          controller.enqueue(textEncoder.encode(" "));
        }, 10000);

        try {
          const planPrompt = PLAN_GENERATOR_PROMPT
            .replace('{USER_GOAL_HERE}', sanitizedGoal)
            .replace(/{USER_EXPERIENCE_HERE}/g, experience || "Beginner (Zero Experience)");

          const planPromise = callGemini(planPrompt, true, MODEL_PLAN_GENERATION);

          const plan = await planPromise;

          clearInterval(timer);
          controller.enqueue(textEncoder.encode(JSON.stringify(plan)));
          controller.close();

        } catch (err: unknown) {
          clearInterval(timer);
          const error = err as Error;
          console.error("Guild Plan Generator Stream Error:", error);
          controller.enqueue(textEncoder.encode(JSON.stringify({ error: "Something went wrong. Try again." })));
          controller.close();
        }
      }
    });

    return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Guild Plan Generator Error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
