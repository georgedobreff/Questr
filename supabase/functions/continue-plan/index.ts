import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { CONTINUE_PLAN_PROMPT } from '../_shared/prompts.ts';
import { callGemini } from '../_shared/llm.ts';
import { MODEL_CONTINUE_MODULE_GENERATION, MODEL_CONTINUE_STORY_GENERATION } from '../_shared/llm_config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

interface Task {
  title: string;
  short_description: string;
  reward: number;
}

interface DailyQuest {
  day: number;
  title: string;
  story?: string;
  tasks: Task[];
}

interface NewModuleContent {
  daily_quests: DailyQuest[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { plan_id, module_to_generate }: { plan_id: string, module_to_generate: number } = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const userSupabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized: No user found.');

    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('goal_text, total_estimated_modules, plan_details, journey_template_id')
      .eq('id', plan_id)
      .eq('user_id', user.id)
      .single();

    if (planError) throw new Error(`Error fetching plan: ${planError.message}`);
    if (!plan) throw new Error('Plan not found or user does not have access.');

    if (module_to_generate > plan.total_estimated_modules) {
      throw new Error('All modules have been generated for this plan.');
    }

    const { count } = await supabaseAdmin
      .from('quests')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan_id)
      .eq('module_number', module_to_generate);

    if (count && count > 0) {
      return new Response(JSON.stringify({ message: `Module ${module_to_generate} already exists.` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    interface PlanModule {
      module_number: number;
      theme: string;
      objectives: string;
      daily_quests?: DailyQuest[];
    }

    const targetModule = (plan.plan_details?.modules as PlanModule[])?.find((m: PlanModule) => m.module_number === module_to_generate);
    const moduleTheme = targetModule?.theme;
    const moduleObjectives = targetModule?.objectives || "Follow the theme closely.";

    if (!moduleTheme) {
      throw new Error(`Could not find theme for module ${module_to_generate} in plan details.`);
    }

    const { data: progressQuests, error: progressError } = await supabaseAdmin
      .from('quests')
      .select('title, tasks ( title, is_completed )')
      .eq('plan_id', plan_id);

    if (progressError) {
      console.error("Failed to fetch user progress, continuing with limited context.", progressError);
    }
    const userProgress = JSON.stringify(progressQuests || "No progress yet.");

    console.log(`[Continue Plan] Processing plan ${plan_id}, module ${module_to_generate}`);

    let newModuleContent: NewModuleContent | null = null;
    let source = "none";

    if (plan.journey_template_id) {
      console.log(`[Continue Plan] Identified as TEMPLATE PLAN (ID: ${plan.journey_template_id}). Checking for content...`);

      const existingModuleData = (plan.plan_details?.modules as PlanModule[])?.find((m: PlanModule) => m.module_number === module_to_generate);
      if (existingModuleData && existingModuleData.daily_quests && existingModuleData.daily_quests.length > 0) {
        newModuleContent = { daily_quests: existingModuleData.daily_quests };
        source = "plan_details";
        console.log(`[Continue Plan] Success: Found content in plan_details.`);
      }

      if (!newModuleContent) {
        console.log(`[Continue Plan] Content missing in plan_details. Fetching from journey_templates table...`);
        const { data: template } = await supabaseAdmin
          .from('journey_templates')
          .select('content')
          .eq('id', plan.journey_template_id)
          .single();

        if (template && template.content && template.content.plan && template.content.plan.modules) {
          const templateModule = (template.content.plan.modules as PlanModule[]).find((m: PlanModule) => m.module_number === module_to_generate);
          if (templateModule && templateModule.daily_quests && templateModule.daily_quests.length > 0) {
            newModuleContent = { daily_quests: templateModule.daily_quests };
            source = "template_cache";
            console.log(`[Continue Plan] Success: Found content in source template.`);
          }
        }
      }

      if (!newModuleContent) {
        console.warn(`[Continue Plan] WARNING: Template Plan ${plan_id} is missing content for module ${module_to_generate} in both plan_details and journey_templates. Falling back to Gemini.`);
      }

    } else {
      console.log(`[Continue Plan] Identified as CUSTOM PLAN (No Template ID). Skipping template checks.`);
    }

    if (!newModuleContent) {
      console.log(`[Continue Plan] Calling Gemini to generate content...`);
      source = "gemini";
      const { data: subscription } = await userSupabaseClient.from("subscriptions").select("status").eq("user_id", user.id).single();
      const status = subscription?.status;
      const validStatuses = ["active", "trialing", "pro"];

      if (!validStatuses.includes(status)) {
        throw new Error('Active subscription required to continue plan.');
      }

      const prompt = CONTINUE_PLAN_PROMPT
        .replace('{USER_GOAL_HERE}', plan.goal_text)
        .replace('{THEME_FOR_WEEK}', moduleTheme)
        .replace('{OBJECTIVES_FOR_WEEK}', moduleObjectives)
        .replace('{USER_PROGRESS_SO_FAR}', userProgress);

      const result = await callGemini(prompt, true, MODEL_CONTINUE_MODULE_GENERATION);
      newModuleContent = result as unknown as NewModuleContent;
    }

    const questsToInsert = newModuleContent.daily_quests.map((quest: DailyQuest) => ({
      plan_id: plan_id,
      module_number: module_to_generate,
      day_number: quest.day,
      title: quest.title,
      story: quest.story
    }));

    const { data: newQuests, error: questsError } = await supabaseAdmin
      .from('quests')
      .insert(questsToInsert)
      .select('id, day_number');

    if (questsError) throw new Error(`Error saving new quests: ${questsError.message}`);

    const dayToQuestIdMap = new Map(newQuests.map((q: { id: number, day_number: number }) => [q.day_number, q.id]));

    const tasksToInsert = newModuleContent.daily_quests.flatMap((dailyQuest: DailyQuest) => {
      const questId = dayToQuestIdMap.get(dailyQuest.day);
      if (!questId) return [];
      return dailyQuest.tasks.map((task: Task) => ({
        quest_id: questId,
        title: task.title,
        short_description: task.short_description,
        reward_coins: task.reward || 5,
      }));
    });

    if (tasksToInsert.length > 0) {
      const { error: tasksError } = await supabaseAdmin.from('tasks').insert(tasksToInsert);
      if (tasksError) throw new Error(`Error saving new tasks: ${tasksError.message}`);
    }

    try {
      const { data: planData } = await supabaseAdmin.from('plans').select('plot').eq('id', plan_id).single();
      const plot = planData?.plot || '';

      let historical_context = '';
      const lastCompletedModule = module_to_generate - 1;

      if (lastCompletedModule === 1) {
        const { data: prevQuests } = await supabaseAdmin
          .from('quests')
          .select('story')
          .eq('plan_id', plan_id)
          .eq('module_number', 1)
          .order('day_number');
        if (prevQuests) {
          historical_context = prevQuests.map((q: { story: string }) => q.story).join('\n\n');
        }
      } else if (lastCompletedModule > 1) {
        const { data: questsToSummarize } = await supabaseAdmin
          .from('quests')
          .select('story')
          .eq('plan_id', plan_id)
          .lt('module_number', lastCompletedModule)
          .order('module_number, day_number');

        const storyToSummarize = questsToSummarize?.map((q: { story: string }) => q.story).join('\n\n') || '';
        const summaryPrompt = `Summarize the following story so far into a single, concise paragraph that can be used as context for writing the next chapter:\n\n${storyToSummarize}`;
        const summary = await callGemini(summaryPrompt, false, MODEL_CONTINUE_STORY_GENERATION);

        const { data: recentQuests } = await supabaseAdmin
          .from('quests')
          .select('story')
          .eq('plan_id', plan_id)
          .eq('module_number', lastCompletedModule)
          .order('day_number');

        const recentStory = recentQuests?.map((q: { story: string }) => q.story).join('\n\n') || '';

        historical_context = `${summary}\n\n${recentStory}`;
      }

      const questsNeedingStories = newModuleContent.daily_quests
        .filter(q => !q.story)
        .map(q => q.day);

      const questIds = newQuests
        .filter((q: { id: number, day_number: number }) => questsNeedingStories.includes(q.day_number))
        .map((q: { id: number }) => q.id);

      if (questIds.length > 0) {
        fetch(
          `${SUPABASE_URL}/functions/v1/generate-quest-stories`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization')!,
            },
            body: JSON.stringify({
              plan_id,
              quest_ids: questIds,
              historical_context,
              plot,
            }),
          }
        );
      }

    } catch (storyError: unknown) {
      const error = storyError as Error;
      console.error('Error triggering story generation:', error.message);
    }

    return new Response(JSON.stringify({ message: `Successfully generated module ${module_to_generate}` }), {
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