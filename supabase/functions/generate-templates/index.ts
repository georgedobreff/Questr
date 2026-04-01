import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PLAN_GENERATOR_PROMPT, STAT_GENERATOR_PROMPT, SHOP_ITEMS_GENERATOR_PROMPT, KEYWORD_GENERATOR_PROMPT } from '../_shared/prompts.ts';
import { iconTags } from '../_shared/icon_tags.ts';
import { findIconForItem } from '../_shared/icon_utils.ts';
import { callGeminiTemplates } from '../_shared/llm.ts';
import { sanitizeInput } from '../_shared/security.ts';
import { 
  MODEL_TEMPLATE_TASK_GENERATION, 
  MODEL_STAT_GENERATION, 
  MODEL_SHOP_ITEM_GENERATION, 
  MODEL_KEYWORD_GENERATION 
} from '../_shared/llm_config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

interface KeywordResponse {
    keywords: string[];
}

interface StatsResponse {
    stats: Stat[];
}

interface ShopItemsResponse {
    shop_items: ShopItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { title, category } = await req.json();

    if (!title || typeof title !== 'string') {
        return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log(`Generating template for: ${title}`);
    const sanitizedTitle = sanitizeInput(title);

    const { data: existing } = await supabaseAdmin
        .from('journey_templates')
        .select('id')
        .ilike('title', sanitizedTitle)
        .maybeSingle();

    if (existing) {
        return new Response(JSON.stringify({ message: `Template '${sanitizedTitle}' already exists.` }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const planPromise = callGeminiTemplates(
        PLAN_GENERATOR_PROMPT.replace('{USER_GOAL_HERE}', sanitizedTitle), 
        true, 
        MODEL_TEMPLATE_TASK_GENERATION
    ) as Promise<Plan>;

    const sideDataPromise = (async () => {
        const statsResult = await callGeminiTemplates(
            STAT_GENERATOR_PROMPT.replace('{USER_GOAL_HERE}', sanitizedTitle), 
            true, 
            MODEL_STAT_GENERATION
        ) as unknown as StatsResponse;
        
        const statNames = statsResult.stats.map((s: Stat) => s.name);
        
        const shopItemsResult = await callGeminiTemplates(
          SHOP_ITEMS_GENERATOR_PROMPT
            .replace('{USER_GOAL_HERE}', sanitizedTitle)
            .replace('{CHARACTER_STATS_HERE}', JSON.stringify(statNames)),
          true,
          MODEL_SHOP_ITEM_GENERATION
        ) as unknown as ShopItemsResponse;
        
        const processedShopItems = await Promise.all(shopItemsResult.shop_items.map(async (item: ShopItem) => {
          let keywords: string[] = [];
          try {
            const keywordResult = await callGeminiTemplates(
              KEYWORD_GENERATOR_PROMPT
                .replace('{ITEM_NAME}', item.name)
                .replace('{ITEM_DESCRIPTION}', item.description),
              true,
              MODEL_KEYWORD_GENERATION
            ) as unknown as KeywordResponse;
            keywords = keywordResult.keywords || [];
          } catch (e) {
            console.error(`Failed keywords for ${item.name}:`, e);
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

        return { stats: statsResult.stats, processedShopItems };
    })();

    const [plan, sideData] = await Promise.all([planPromise, sideDataPromise]);
    const { stats, processedShopItems } = sideData;

    const templateContent = {
        plan: plan,
        stats: stats,
        shop_items: processedShopItems
    };

    const { error: insertError } = await supabaseAdmin
        .from('journey_templates')
        .insert({
            title: sanitizedTitle,
            category: category || 'Custom',
            description: plan.plot || `A journey to become a ${sanitizedTitle}`,
            content: templateContent
        });

    if (insertError) throw new Error(insertError.message);

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Created template: ${sanitizedTitle}`
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Generate Template Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});