import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { streamGemini } from '../_shared/llm.ts';
import { MODEL_QUIZ_EXPLANATION } from '../_shared/llm_config.ts';
import { QUIZ_EXPLANATION_PROMPT } from '../_shared/prompts.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { boss_fight_id, user_answers, questions: providedQuestions }: { boss_fight_id: string, user_answers: number[], questions?: unknown[] } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    const [fightRes, subRes] = await Promise.all([
      supabase
        .from('boss_fights')
        .select('*, plans(goal_text, plan_details)')
        .eq('id', boss_fight_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .single()
    ]);

    const fight = fightRes.data;
    if (!fight) throw new Error("Fight record not found");

    const status = subRes.data?.status;
    const validStatuses = ["active", "trialing", "pro"];

    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Active subscription required.' }), { status: 402, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const questions = providedQuestions || (typeof fight.questions === 'string' ? JSON.parse(fight.questions) : fight.questions);
    const planDetails = fight.plans?.plan_details;

    interface PlanModule {
      module_number: number;
      theme: string;
    }

    const module = (planDetails?.modules as PlanModule[] | undefined)?.find((m: PlanModule) => m.module_number === fight.module_number);

    interface Question {
      question: string;
      options: string[];
      correct_index: number;
    }

    interface Result {
      question: string;
      user_answer: string;
      correct_answer: string;
      result: "CORRECT" | "WRONG";
    }

    const results = (questions as Question[]).map((q: Question, i: number) => {
      const userAnswerIndex = user_answers[i];
      const isCorrect = userAnswerIndex === q.correct_index;
      return {
        question: q.question,
        user_answer: q.options[userAnswerIndex] || "No Answer",
        correct_answer: q.options[q.correct_index],
        result: isCorrect ? "CORRECT" : "WRONG"
      } as Result;
    }).filter((r: Result) => r.result === "WRONG");

    if (results.length === 0) {
      return new Response("You answered everything correctly! The path is clear.", {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const prompt = QUIZ_EXPLANATION_PROMPT
      .replace('{USER_GOAL}', fight.plans?.goal_text || "Mastery")
      .replace('{MODULE_THEME}', module?.theme || "General Knowledge")
      .replace('{QUIZ_RESULTS_JSON}', JSON.stringify(results, null, 2));

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      let aiResponseFull = "";
      try {
        const stream = streamGemini(prompt, MODEL_QUIZ_EXPLANATION);
        for await (const chunk of stream) {
          aiResponseFull += chunk;
          await writer.write(encoder.encode(chunk));
        }

        if (aiResponseFull) {
          await supabase.from('boss_fights').update({ explanation: aiResponseFull }).eq('id', boss_fight_id);
        }
      } catch (e) {
        console.error("Stream error", e);
        const err = e as Error;
        await writer.write(encoder.encode(`\n[Error: ${err.message}]`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
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
