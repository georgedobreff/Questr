import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini } from '../_shared/llm.ts';
import { MODEL_BOSS_QUIZ_GENERATION } from '../_shared/llm_config.ts';
import { BOSS_FIGHT_GENERATOR_PROMPT } from '../_shared/prompts.ts';

const ENEMIES = [
    { name: 'Demon', path: '/assets/3d-models/enemies/Demon.gltf' },
    { name: 'Giant', path: '/assets/3d-models/enemies/Giant.gltf' },
    { name: 'Goblin', path: '/assets/3d-models/enemies/Goblin.gltf' },
    { name: 'Skeleton', path: '/assets/3d-models/enemies/Skeleton.gltf' },
    { name: 'Wizard', path: '/assets/3d-models/enemies/Wizard.gltf' },
    { name: 'Yeti', path: '/assets/3d-models/enemies/Yeti.gltf' },
    { name: 'Zombie', path: '/assets/3d-models/enemies/Zombie.gltf' },
];

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { plan_id, module_number, regenerate }: { plan_id: string, module_number: number, regenerate?: boolean } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');
        const { data: subscription } = await supabase.from('subscriptions').select('status').eq('user_id', user.id).single();
        const status = subscription?.status;
        const validStatuses = ["active", "trialing", "pro"];

        if (!validStatuses.includes(status)) {
            return new Response(JSON.stringify({ error: 'Active subscription required for boss fights.' }), { status: 402, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        const { data: existingFight } = await supabase
            .from('boss_fights')
            .select('*')
            .eq('user_id', user.id)
            .eq('plan_id', plan_id)
            .eq('module_number', module_number)
            .single();

        if (existingFight) {
            if (!regenerate && existingFight.cooldown_until) {
                const now: Date = new Date();
                const cooldown: Date = new Date(existingFight.cooldown_until);
                if (now < cooldown) {
                    return new Response(JSON.stringify({
                        cooldown_active: true,
                        cooldown_until: existingFight.cooldown_until,
                        status: existingFight.status,
                        story_plot: existingFight.story_plot
                    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }

            if (!regenerate) {
                if (existingFight.status === 'active' || existingFight.status === 'defeated') {
                    return new Response(JSON.stringify(existingFight), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }
        }

        const { data: plan } = await supabase
            .from('plans')
            .select('goal_text, plan_details')
            .eq('id', plan_id)
            .single();

        if (!plan) throw new Error("Plan not found");

        interface PlanModule {
            module_number: number;
            theme: string;
            objectives: string;
        }

        const module = (plan.plan_details?.modules as PlanModule[] | undefined)?.find((m: PlanModule) => m.module_number === module_number);
        const theme = module?.theme || "General Knowledge";
        const objectives = module?.objectives || "Review completed tasks.";
        const { data: quests } = await supabase
            .from('quests')
            .select('tasks(title, short_description)')
            .eq('plan_id', plan_id)
            .eq('module_number', module_number);

        interface Task {
            title: string;
            short_description: string;
        }

        const tasks = quests?.flatMap(q => q.tasks as unknown as Task[]) || [];
        const tasksContext = tasks.map((t) => `- ${t.title}: ${t.short_description}`).join('\n');

        const prompt = BOSS_FIGHT_GENERATOR_PROMPT
            .replace('{USER_GOAL}', plan.goal_text)
            .replace('{MODULE_THEME}', theme)
            .replace('{MODULE_OBJECTIVES}', objectives)
            .replace('{COMPLETED_TASKS}', tasksContext)
            .replace('{ENEMY_LIST}', ENEMIES.map(e => e.name).join(', '));

        interface GeneratedQuiz {
            boss_type: string;
            story_plot: string;
            questions: Question[];
        }

        console.log(`Generating Boss Fight...`);
        const result = await callGemini(prompt, true, MODEL_BOSS_QUIZ_GENERATION);
        const aiResponse = result as unknown as GeneratedQuiz;

        let bossType = "Skeleton";
        let storyPlot = "A guardian blocks your path.";
        let generatedQuestions: Question[] = [];

        try {
            const json = aiResponse;
            bossType = json.boss_type || "Skeleton";
            storyPlot = json.story_plot || storyPlot;
            generatedQuestions = json.questions || [];
        } catch (e) {
            console.error("Failed to parse AI response", e);
        }

        if (generatedQuestions.length < 1) {
            generatedQuestions = [{
                question: "Ready to proceed?",
                options: ["Yes", "No", "Maybe", "Later"],
                correct_index: 0
            }];
        }

        const bossModel = ENEMIES.find((e: { name: string, path: string }) => e.name === bossType) || ENEMIES[3]; // Fallback to Skeleton
        const nextCooldown: string | null = (existingFight && regenerate) ? (existingFight.cooldown_until || null) : null;

        const payload = {
            user_id: user.id,
            plan_id,
            module_number,
            boss_type: bossModel.name,
            boss_model_path: bossModel.path,
            story_plot: storyPlot,
            questions: generatedQuestions,
            player_hp: 100,
            boss_hp: 100,
            status: 'active',
            cooldown_until: nextCooldown,
            updated_at: new Date().toISOString()
        };

        const { data: savedFight, error: saveError } = await supabase
            .from('boss_fights')
            .upsert(payload, { onConflict: 'user_id, plan_id, module_number' })
            .select()
            .single();

        if (saveError) throw saveError;

        return new Response(JSON.stringify(savedFight), {

            status: 200,

            headers: { ...corsHeaders, 'Content-Type': 'application/json' },

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