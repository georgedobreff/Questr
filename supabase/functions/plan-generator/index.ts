import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { CONTENT_MODERATION_PROMPT, PLAN_GENERATOR_PROMPT, STAT_GENERATOR_PROMPT, SHOP_ITEMS_GENERATOR_PROMPT, KEYWORD_GENERATOR_PROMPT } from '../_shared/prompts.ts';
import { iconTags } from '../_shared/icon_tags.ts';
import { findIconForItem } from '../_shared/icon_utils.ts';
import { callGemini } from '../_shared/llm.ts';
import { sanitizeInput } from '../_shared/security.ts';
import {
  MODEL_CONTENT_MODERATION,
  MODEL_PLAN_GENERATION,
  MODEL_STAT_GENERATION,
  MODEL_SHOP_ITEM_GENERATION,
  MODEL_KEYWORD_GENERATION
} from '../_shared/llm_config.ts';

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

interface Module {
  module_number: number;
  theme: string;
  objectives?: string;
  daily_quests: DailyQuest[];
}

interface Plan {
  goal_title: string;
  total_estimated_duration_weeks: number;
  plot?: string;
  modules: Module[];
}

interface Stat {
  name: string;
  value: number;
}

interface ShopItem {
  name: string;
  description: string;
  cost: number;
  asset_url: string;
  type: string;
  slot: string;
  stat_buffs?: Record<string, number> | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { goal_text, abandon_previous, experience }: { goal_text: string, abandon_previous: boolean, experience?: string } = await req.json();

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

    const { data: existingTemplate } = await supabaseAdmin
      .from('journey_templates')
      .select('id')
      .ilike('title', sanitizedGoal)
      .maybeSingle();

    if (existingTemplate) {
      console.log(`Cache Hit: Found template for "${sanitizedGoal}" (${existingTemplate.id})`);

      const { data: planDetails, error: rpcError } = await supabaseAdmin.rpc('instantiate_journey_template', {
        p_template_id: existingTemplate.id,
        p_user_id: user.id
      });

      if (rpcError) {
        throw new Error(`RPC Error: ${rpcError.message}`);
      }

      return new Response(JSON.stringify(planDetails), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: subscription } = await supabaseAdmin.from('subscriptions').select('status, updated_at').eq('user_id', user.id).single();
    const status = subscription?.status;
    const validStatuses = ["active", "trialing", "pro"];

    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Active subscription required to generate a custom path.' }), { status: 402, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('last_plan_generated_at, plan_generations_count, plan_generations_period_start, purchased_plan_credits')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Error fetching profile: ${profileError.message}`);
    }

    const now = new Date();

    let currentCount = profile?.plan_generations_count || 0;
    let periodStart = profile?.plan_generations_period_start ? new Date(profile.plan_generations_period_start) : now;
    const lastGenTime = profile?.last_plan_generated_at ? new Date(profile.last_plan_generated_at).getTime() : 0;
    let purchasedCredits = profile?.purchased_plan_credits || 0;
    let usedCredit = false;

    const monthlyLimit = 2;

    if (currentCount >= monthlyLimit) {
      if (purchasedCredits > 0) {
        usedCredit = true;
        purchasedCredits--;
      } else {
        return new Response(JSON.stringify({ error: "You have reached your monthly limit of 2 plans." }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    const debounceTime = 60 * 1000;

    if (now.getTime() - lastGenTime < debounceTime) {
      return new Response(JSON.stringify({ error: "Please wait a minute before trying again." }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }


    const newCount = currentCount + 1;

    interface ProfileUpdate {
      id: string;
      last_plan_generated_at: string;
      plan_generations_count: number;
      plan_generations_period_start: string;
      purchased_plan_credits?: number;
    }

    const updatePayload: ProfileUpdate = {
      id: user.id,
      last_plan_generated_at: now.toISOString(),
      plan_generations_count: newCount,
      plan_generations_period_start: periodStart.toISOString()
    };

    if (usedCredit) {
      updatePayload.purchased_plan_credits = purchasedCredits;
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert(updatePayload);

    if (updateError) {
      console.error("Failed to update rate limit timestamp, but continuing plan generation.", updateError)
    }

    if (abandon_previous) {
      const { data: oldPlans, error: oldPlansError } = await supabaseAdmin
        .from('plans')
        .select('id')
        .eq('user_id', user.id);

      if (oldPlansError) {
        console.error("Error fetching old plans for deletion:", oldPlansError);
      }

      if (oldPlans && oldPlans.length > 0) {
        for (const oldPlan of oldPlans) {
          const { data: oldQuests } = await supabaseAdmin.from('quests').select('id').eq('plan_id', oldPlan.id);
          if (oldQuests && oldQuests.length > 0) {
            const oldQuestIds = oldQuests.map(q => q.id);
            await supabaseAdmin.from('tasks').delete().in('quest_id', oldQuestIds);
          }
          await supabaseAdmin.from('user_stats').delete().eq('plan_id', oldPlan.id);
          await supabaseAdmin.from('shop_items').delete().eq('plan_id', oldPlan.id);
          await supabaseAdmin.from('quests').delete().eq('plan_id', oldPlan.id);
          await supabaseAdmin.from('plans').delete().eq('id', oldPlan.id);
        }
      }
    }



    console.log(`Cache Miss: Generating new plan for "${sanitizedGoal}"`);

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

          const planPromise = callGemini(planPrompt, true, MODEL_PLAN_GENERATION) as unknown as Promise<Plan>;

          const sideDataPromise = (async () => {
            const statsResult = await callGemini(STAT_GENERATOR_PROMPT.replace('{USER_GOAL_HERE}', sanitizedGoal), true, MODEL_STAT_GENERATION);
            const { stats } = statsResult as unknown as { stats: Stat[] };
            const statNames = stats.map(s => s.name);

            const shopItemsResult = await callGemini(
              SHOP_ITEMS_GENERATOR_PROMPT
                .replace('{USER_GOAL_HERE}', sanitizedGoal)
                .replace('{CHARACTER_STATS_HERE}', JSON.stringify(statNames)),
              true,
              MODEL_SHOP_ITEM_GENERATION
            );
            const { shop_items } = shopItemsResult as unknown as { shop_items: ShopItem[] };

            const processedShopItems = await Promise.all(shop_items.map(async (item: ShopItem) => {
              let keywords: string[] = [];
              try {
                const keywordResult = await callGemini(
                  KEYWORD_GENERATOR_PROMPT
                    .replace('{ITEM_NAME}', item.name)
                    .replace('{ITEM_DESCRIPTION}', item.description),
                  true,
                  MODEL_KEYWORD_GENERATION
                );
                interface KeywordResponse { keywords: string[] }
                const json = keywordResult as unknown as KeywordResponse;
                keywords = json.keywords || [];
              } catch (e) {
                console.error(`Failed to generate keywords for item: ${item.name}`, e);
                keywords = item.name.toLowerCase().split(' ');
              }

              const icon = findIconForItem(item.name, keywords, iconTags);
              return {
                ...item,
                asset_url: icon,
                slot: item.slot || 'misc',
                cost: item.cost ?? 0,
                type: item.type || 'equippable'
              };
            }));

            return { stats, processedShopItems };
          })();

          const [plan, sideData] = await Promise.all([planPromise, sideDataPromise]);
          const { stats, processedShopItems } = sideData;



          const { data: newPlan, error: planInsertError } = await supabaseAdmin
            .from('plans')
            .insert({
              user_id: user.id,
              goal_text: sanitizedGoal,
              complexity: 'pro',
              total_estimated_duration_weeks: plan.total_estimated_duration_weeks,
              total_estimated_modules: plan.modules.length,
              plot: plan.plot,
              plan_details: plan
            })
            .select('id')
            .single();

          if (planInsertError) throw new Error(`Error saving plan: ${planInsertError.message}`);
          const newPlanId = newPlan.id;

          if (stats && stats.length > 0) {
            const statsToInsert = stats.map(s => ({
              user_id: user.id,
              plan_id: newPlanId,
              name: s.name,
              value: s.value
            }));
            await supabaseAdmin.from('user_stats').insert(statsToInsert);
          }

          if (processedShopItems && processedShopItems.length > 0) {
            const itemsToInsert = processedShopItems.map(item => ({
              plan_id: newPlanId,
              name: item.name,
              description: item.description,
              cost: item.cost,
              asset_url: item.asset_url,
              slot: item.slot,
              type: item.type,
              stat_buffs: item.stat_buffs || null
            }));
            await supabaseAdmin.from('shop_items').insert(itemsToInsert);
          }

          const module1 = plan.modules.find(m => m.module_number === 1);
          if (module1 && module1.daily_quests) {
            for (const quest of module1.daily_quests) {
              const { data: newQuest, error: Questrror } = await supabaseAdmin
                .from('quests')
                .insert({
                  plan_id: newPlanId,
                  module_number: 1,
                  day_number: quest.day,
                  title: quest.title,
                  story: quest.story
                })
                .select('id')
                .single();

              if (Questrror) console.error("Error saving quest:", Questrror);

              if (newQuest && quest.tasks) {
                const tasksToInsert = quest.tasks.map(t => ({
                  quest_id: newQuest.id,
                  title: t.title,
                  short_description: t.short_description,
                  reward_coins: t.reward
                }));
                await supabaseAdmin.from('tasks').insert(tasksToInsert);
              }
            }
          }

          clearInterval(timer);
          controller.enqueue(textEncoder.encode(JSON.stringify(plan)));
          controller.close();

        } catch (err: unknown) {
          clearInterval(timer);
          const error = err as Error;
          console.error("Plan Generator Stream Error:", error);
          controller.enqueue(textEncoder.encode(JSON.stringify({ error: "Something went wrong. Try again." })));
          controller.close();
        }
      }
    });

    return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Plan Generator Error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
