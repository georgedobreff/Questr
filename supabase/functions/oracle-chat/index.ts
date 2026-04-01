import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { streamGemini } from '../_shared/llm.ts';
import { MODEL_ORACLE_CHAT } from '../_shared/llm_config.ts';
import { ORACLE_PROMPT } from '../_shared/prompts.ts';
import { sanitizeInput } from '../_shared/security.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signal = req.signal;

  try {
    const { message }: { message?: string } = await req.json();

    if (!message || typeof message !== 'string' || message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Message must be a string and under 1000 characters.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const [profileRes, subscriptionRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('full_name, last_oracle_chat_at, oracle_messages_count, oracle_messages_period_start')
        .eq('id', user.id)
        .single(),
      userSupabaseClient
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .single()
    ]);

    const profile = profileRes.data;
    const profileError = profileRes.error;
    const status = subscriptionRes.data?.status;
    const validStatuses = ["active", "trialing", "pro"];

    const isPro = validStatuses.includes(status);

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Error fetching profile: ${profileError.message}`);
    }

    const now = new Date();

    // 1. Spam Protection (3s cooldown)
    if (profile && profile.last_oracle_chat_at) {
      const lastChatTime = new Date(profile.last_oracle_chat_at).getTime();
      const threeSeconds = 3 * 1000;
      if (now.getTime() - lastChatTime < threeSeconds) {
        return new Response(JSON.stringify({ error: "You're going too fast." }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // 2. Hourly Rate Limit
    const hourlyLimit = isPro ? 200 : 35;
    const oneHour = 60 * 60 * 1000;

    let currentCount = profile?.oracle_messages_count || 0;
    let periodStart = profile?.oracle_messages_period_start ? new Date(profile.oracle_messages_period_start) : now;

    if (now.getTime() - periodStart.getTime() > oneHour) {
      currentCount = 0;
      periodStart = now;
    }

    if (currentCount >= hourlyLimit) {
      return new Response(JSON.stringify({ error: "You have reached your hourly limit. Wait an hour or upgrade for much higher limits." }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const newCount = currentCount + 1;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        last_oracle_chat_at: now.toISOString(),
        oracle_messages_count: newCount,
        oracle_messages_period_start: periodStart.toISOString()
      });

    if (updateError) {
      throw new Error(`Error updating timestamp: ${updateError.message}`);
    }

    const sanitizedMessage = sanitizeInput(message!);
    const { error: insertError } = await supabaseAdmin.from('chat_history').insert({ user_id: user.id, role: 'user', content: sanitizedMessage });
    if (insertError) {
      console.error("Failed to save user message:", insertError);
    }

    const { data: assistantMsg, error: assistantInsertError } = await supabaseAdmin
      .from('chat_history')
      .insert({ user_id: user.id, role: 'assistant', content: '' })
      .select('id')
      .single();

    if (assistantInsertError) {
      console.error("Failed to save assistant placeholder:", assistantInsertError);
    }
    const assistantMessageId = assistantMsg?.id;

    const [planRes, historyRes] = await Promise.all([
      userSupabaseClient.from("plans").select("*, quests(*, tasks(*))").eq("user_id", user.id).maybeSingle(),
      userSupabaseClient.from("chat_history").select("role, content").eq("user_id", user.id).order('created_at', { ascending: false }).limit(50)
    ]);

    const activePlan = planRes.data;
    const chatHistory = (historyRes.data || []).reverse();
    let context = "The user has no active path.";
    if (activePlan) {
      interface Quest {
        id: number;
        module_number: number;
        day_number: number;
        tasks: { id: number; is_completed: boolean; title: string; short_description: string | null }[];
      }
      const questsByModule = (activePlan.quests as unknown as Quest[] || []).reduce((acc: Record<number, Quest[]>, quest: Quest) => {
        const moduleNum = quest.module_number;
        if (!acc[moduleNum]) acc[moduleNum] = [];
        acc[moduleNum].push(quest);
        return acc;
      }, {} as Record<number, Quest[]>);


      Object.values(questsByModule).forEach(quests => {
        quests.sort((a, b) => a.day_number - b.day_number);
        quests.forEach(q => {
          q.tasks.sort((a, b) => a.id - b.id);
        });
      });

      const sortedModuleNumbers = Object.keys(questsByModule).map((n: string) => Number(n)).sort((a: number, b: number) => a - b);
      let activeModuleNumber = -1;
      let lastModuleWithTasks = -1;

      for (const moduleNumber of sortedModuleNumbers) {
        const tasksInModule = questsByModule[moduleNumber].flatMap((q: Quest) => q.tasks);

        if (tasksInModule.length > 0) {
          lastModuleWithTasks = moduleNumber;
        }

        if (tasksInModule.some((t: { is_completed: boolean }) => !t.is_completed)) {
          activeModuleNumber = moduleNumber;
          break;
        }
      }
      const highLevelSummary = `The user is on a path to achieve the goal: "${activePlan.goal_text}".`;
      let activeChapterContext = "They have no currently active chapter.";
      if (activeModuleNumber !== -1) {
        const activeChapterQuests = questsByModule[activeModuleNumber];
        const activeTasks = activeChapterQuests.flatMap(q => q.tasks.filter((t: { is_completed: boolean }) => !t.is_completed));

        if (activeTasks.length > 0) {
          const currentTask = activeTasks[0];
          const currentTaskStr = `CURRENT TASK: "${currentTask.title}"${currentTask.short_description ? ` - ${currentTask.short_description}` : ''}`;

          const upcomingTasksStr = activeTasks.slice(1).map((t: { title: string }) => `"${t.title}"`).join(', ');
          const upcomingContext = upcomingTasksStr ? `\nUPCOMING TASKS: ${upcomingTasksStr}` : '';

          activeChapterContext = `The user is in Chapter ${activeModuleNumber}.\n${currentTaskStr}${upcomingContext}`;
        } else {
          activeChapterContext = `The user has completed all tasks in Chapter ${activeModuleNumber}.`;
        }
      } else if (lastModuleWithTasks !== -1) {
        if (lastModuleWithTasks < (activePlan.total_estimated_modules || 999)) {
          const nextModule = lastModuleWithTasks + 1;
          activeChapterContext = `The user has completed all tasks in Chapter ${lastModuleWithTasks}. They are ready to begin Chapter ${nextModule}.`;
        } else {
          activeChapterContext = `The user has completed their entire journey (Chapter ${lastModuleWithTasks})! They have achieved their goal.`;
        }
      }
      context = highLevelSummary + "\n" + activeChapterContext;
    }

    const chatHistoryForPrompt = chatHistory.slice(-50).map((m: { role: string, content: string }) => `${m.role}: ${m.content}`).join('\n');
    const userName = profile?.full_name || 'Adventurer';

    const finalPrompt = ORACLE_PROMPT
      .replace('{USER_NAME_HERE}', userName)
      .replace('{CONTEXT}', context)
      .replace('{CHAT_HISTORY}', chatHistoryForPrompt);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      let aiResponseFull = "";
      try {
        const stream = streamGemini(finalPrompt, MODEL_ORACLE_CHAT, signal);

        for await (const chunk of stream) {
          if (signal.aborted) {
            console.log("Request aborted by client.");
            break;
          }
          aiResponseFull += chunk;
          await writer.write(encoder.encode(chunk));
        }

        if (aiResponseFull && assistantMessageId) {
          const { data: currentMsg } = await supabaseAdmin
            .from('chat_history')
            .select('content')
            .eq('id', assistantMessageId)
            .single();

          if (!currentMsg?.content?.includes("Response cancelled")) {
            const { error: saveError } = await supabaseAdmin
              .from('chat_history')
              .update({ content: aiResponseFull })
              .eq('id', assistantMessageId);

            if (saveError) {
              console.error("Failed to update assistant message:", saveError);
            }
          } else {
            console.log("Skipping AI save: User has already truncated or cancelled this message.");
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Streaming error:", error);
        if (!signal.aborted) {
          await writer.write(encoder.encode("\n[Error: Something went wrong. Try again.]"));
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
