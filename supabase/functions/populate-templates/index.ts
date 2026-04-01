import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { TEMPLATE_POPULATION_PROMPT, STORY_GENERATOR_PROMPT } from '../_shared/prompts.ts';
import { callGeminiTemplates } from '../_shared/llm.ts';
import { MODEL_TEMPLATE_TASK_GENERATION, MODEL_TEMPLATE_STORY_GENERATION } from '../_shared/llm_config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface QuestTask {
    title: string;
    short_description: string;
    reward: number;
}

interface DailyQuest {
    day: number;
    title: string;
    story?: string;
    tasks: QuestTask[];
}

interface Module {
    module_number: number;
    theme: string;
    objectives?: string;
    daily_quests: DailyQuest[];
}

interface TemplateContent {
    plan: {
        plot?: string;
        modules: Module[];
    };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { data: templates, error: fetchError } = await supabaseAdmin
        .from('journey_templates')
        .select('id, title, content')
        .order('title');

    if (fetchError) throw new Error(`Error fetching templates: ${fetchError.message}`);

    let targetTemplateId = null;
    let targetTemplateTitle = "";
    let targetModuleIndex = -1;
    let targetModuleNumber = -1;
    let templateContent: TemplateContent | null = null;

    for (const template of templates) {
        if (!template.content?.plan?.modules) continue;
        
        const content = template.content as TemplateContent;
        const modules = content.plan.modules;
        const emptyModuleIndex = modules.findIndex((m: Module) => !m.daily_quests || m.daily_quests.length === 0);

        if (emptyModuleIndex !== -1) {
            targetTemplateId = template.id;
            targetTemplateTitle = template.title;
            targetModuleIndex = emptyModuleIndex;
            targetModuleNumber = modules[emptyModuleIndex].module_number;
            templateContent = content;
            break;
        }
    }

    if (!targetTemplateId) {
        return new Response(JSON.stringify({ status: "completed", message: "All templates are fully populated." }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    console.log(`Processing Template: ${targetTemplateTitle} (ID: ${targetTemplateId}), Module: ${targetModuleNumber}`);

    const modules = templateContent.plan.modules;
    const previousModule = modules[targetModuleIndex - 1];
    const priorModules = modules.slice(0, targetModuleIndex - 1);
    
    if (!previousModule) {
        throw new Error("Module 1 is empty. Cannot continue from nothing.");
    }

    const previousModuleFullContext = JSON.stringify(previousModule.daily_quests);
    const priorModulesSummary = priorModules.map((m: Module) => `Week ${m.module_number}: ${m.theme} - ${m.objectives}`).join("\n");
    const currentModule = modules[targetModuleIndex];

    const prompt = TEMPLATE_POPULATION_PROMPT
        .replace('{USER_GOAL_HERE}', targetTemplateTitle)
        .replace('{THEME_FOR_WEEK}', currentModule.theme)
        .replace('{OBJECTIVES_FOR_WEEK}', currentModule.objectives || "Master the weekly theme.")
        .replace('{PRIOR_MODULES_SUMMARY}', priorModulesSummary || "No prior modules (Week 2).")
        .replace('{PREVIOUS_MODULE_FULL}', previousModuleFullContext);

    console.log("Generating tasks...");
    const taskResult = await callGeminiTemplates(prompt, true, MODEL_TEMPLATE_TASK_GENERATION);
    const generatedQuests = (taskResult as { daily_quests: DailyQuest[] }).daily_quests;

    if (!generatedQuests || generatedQuests.length !== 7) {
        throw new Error("Gemini failed to generate 7 valid daily quests.");
    }

    const mainPlot = templateContent.plan.plot || "A heroic journey of mastery.";
    
    let previousStory = "";
    if (previousModule.daily_quests && previousModule.daily_quests.length > 0) {
        const lastDay = previousModule.daily_quests[previousModule.daily_quests.length - 1];
        previousStory = lastDay.story || "You completed the previous week's challenges.";
    }

    console.log("Generating stories...");
    
    for (let i = 0; i < 7; i++) {
        const dayQuest = generatedQuests[i];
        
        const storyPrompt = STORY_GENERATOR_PROMPT
            .replace('{MAIN_PLOT}', mainPlot)
            .replace('{PREVIOUS_STORY}', previousStory)
            .replace('{CURRENT_QUEST_GOAL}', dayQuest.title);

        const storyResult = await callGeminiTemplates(storyPrompt, true, MODEL_TEMPLATE_STORY_GENERATION);
        const newStory = (storyResult as { story: string }).story;

        dayQuest.story = newStory;
        
        previousStory = newStory;
    }

    templateContent.plan.modules[targetModuleIndex].daily_quests = generatedQuests;

    console.log(`Saving Module ${targetModuleNumber} for '${targetTemplateTitle}'. Payload size: ${JSON.stringify(generatedQuests).length} chars.`);

    const { error: updateError } = await supabaseAdmin
        .from('journey_templates')
        .update({ content: templateContent })
        .eq('id', targetTemplateId);

    if (updateError) throw new Error(`Error updating template: ${updateError.message}`);

    return new Response(JSON.stringify({ 
        status: "continued", 
        template: targetTemplateTitle, 
        module: targetModuleNumber,
        message: `Successfully populated Module ${targetModuleNumber}` 
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Template Populator Error:", error);
    return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
