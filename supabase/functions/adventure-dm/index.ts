import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini } from '../_shared/llm.ts';
import { MODEL_DUNGEON_GENERATION, MODEL_ADVENTURE_INTERACTION } from '../_shared/llm_config.ts';
import { ADVENTURE_PROMPT, DUNGEON_GENERATOR_PROMPT } from '../_shared/prompts.ts';
import { iconTags } from '../_shared/icon_tags.ts';
import { findIconForItem } from '../_shared/icon_utils.ts';
import { sanitizeInput } from '../_shared/security.ts';

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { message, action }: { message?: string, action: string } = await req.json();

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const userSupabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user } } = await userSupabaseClient.auth.getUser();
        if (!user) throw new Error('Unauthorized');

        const [profileRes, statsRes, inventoryRes, planRes, subscriptionRes] = await Promise.all([
            supabaseAdmin.from('profiles').select('full_name, action_points, last_adventure_at').eq('id', user.id).single(),
            userSupabaseClient.from("user_stats").select("name, value").eq("user_id", user.id),
            userSupabaseClient.from("user_items").select("item_id, shop_items(name, description)").eq("user_id", user.id),
            userSupabaseClient.from("plans").select("goal_text, plot").eq("user_id", user.id).maybeSingle(),
            userSupabaseClient.from("subscriptions").select("status").eq("user_id", user.id).single()
        ]);

        const profile = profileRes.data;
        const stats = statsRes.data || [];
        const now = new Date();

        if (profile && profile.last_adventure_at) {
            const lastActionTime = new Date(profile.last_adventure_at).getTime();
            const threeSeconds = 1 * 1000;
            if (now.getTime() - lastActionTime < threeSeconds) {
                return new Response(JSON.stringify({ error: "You're going too fast." }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
            }
        }

        await supabaseAdmin.from('profiles').update({ last_adventure_at: now.toISOString() }).eq('id', user.id);

        const sanitizedMessage = message ? sanitizeInput(message) : "";

        interface InventoryItem {
            item_id: number;
            shop_items: {
                name: string;
                description: string;
            };
        }

        interface Stat {
            name: string;
            value: number;
        }

        const inventory = (inventoryRes.data as InventoryItem[] | null)?.map((i: InventoryItem) => i.shop_items.name).join(", ") || "Empty";
        const plan = planRes.data;
        const isPro = ["active", "trialing", "pro"].includes(subscriptionRes.data?.status);

        const statsStr = (stats as Stat[]).map((s: Stat) => `${s.name}: ${s.value}`).join(", ");

        // --- START NEW DUNGEON LOGIC ---
        if (action === 'start') {
            await supabaseAdmin.from('adventure_chat_history').delete().eq('user_id', user.id);

            interface EnterDungeonResult {
                success: boolean;
                error?: string;
            }

            const { data: entryResult, error: rpcError } = await supabaseAdmin.rpc('enter_dungeon', { p_user_id: user.id });
            const result = entryResult as EnterDungeonResult;

            if (rpcError || !result || !result.success) {
                const errorMsg = result?.error || rpcError?.message || "Failed to enter dungeon (Insufficient Resources or Subscription).";
                return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const { error: insertError } = await supabaseAdmin.from('adventure_states').insert({
                user_id: user.id,
                is_active: true,
                theme: null,
                inventory_snapshot: inventoryRes.data,
                stats_snapshot: stats
            });

            if (insertError) {
                console.error("Failed to reserve dungeon state:", insertError);
                throw new Error("Failed to start dungeon generation.");
            }

            let dungeonJson;
            try {
                const generatorPrompt = DUNGEON_GENERATOR_PROMPT
                    .replace('{GOAL}', plan?.goal_text || "To become a legend")
                    .replace('{PLOT}', plan?.plot || "You are wandering the lands seeking adventure.")
                    .replace('{STATS}', statsStr)
                    .replace('{INVENTORY}', inventory);

                interface DungeonJson {
                    title: string;
                    theme: string;
                    win_condition: string;
                    reward: object;
                    locations: object[];
                    enemies: object[];
                    puzzles: object[];
                    dungeon_items: RawDungeonItem[];
                    opening_scene: string;
                }

                const result = await callGemini(generatorPrompt, true, MODEL_DUNGEON_GENERATION, req.signal);
                dungeonJson = result as unknown as DungeonJson;
            } catch (e) {
                await supabaseAdmin.from('adventure_states').delete().eq('user_id', user.id);
                throw e;
            }

            interface RawDungeonItem {
                name: string;
            }
            interface DungeonItem extends RawDungeonItem {
                found: boolean;
                consumed: boolean;
            }

            const processedItems: DungeonItem[] = (dungeonJson.dungeon_items || []).map((i: RawDungeonItem) => ({ ...i, found: false, consumed: false }));

            const { error: updateError } = await supabaseAdmin.from('adventure_states').update({
                title: dungeonJson.title,
                theme: dungeonJson.theme,
                win_condition: dungeonJson.win_condition,
                reward_summary: JSON.stringify(dungeonJson.reward),
                locations: dungeonJson.locations,
                enemies: dungeonJson.enemies,
                puzzles: dungeonJson.puzzles,
                dungeon_items: processedItems
            }).eq('user_id', user.id);

            if (updateError) {
                console.error("Failed to save dungeon state:", updateError);
                throw new Error("Failed to initialize dungeon state.");
            }

            await supabaseAdmin.from('notifications').insert({
                user_id: user.id,
                title: 'Dungeon Ready!',
                message: `The ${dungeonJson.theme} has been forged. Enter now!`,
                type: 'info',
                action_link: '/adventure'
            });

            const introMessage = dungeonJson.opening_scene;
            await supabaseAdmin.from('adventure_chat_history').insert({ user_id: user.id, role: 'assistant', content: JSON.stringify({ message: introMessage, status: 'PLAYING' }) });

            return new Response(JSON.stringify({ title: dungeonJson.title, message: introMessage, status: 'PLAYING' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (action === 'retreat') {
            await Promise.all([
                supabaseAdmin.from('adventure_states').delete().eq('user_id', user.id),
                supabaseAdmin.from('adventure_chat_history').delete().eq('user_id', user.id)
            ]);

            const retreatMessage = "You have fled the dungeon in shame. The path closes behind you.";

            return new Response(JSON.stringify({ message: retreatMessage, status: 'DEFEAT' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: dungeonState } = await supabaseAdmin.from('adventure_states').select('*').eq('user_id', user.id).eq('is_active', true).single();

        if (!dungeonState) {
            return new Response(JSON.stringify({ message: "You are not in a dungeon. Start one!", status: 'ENDED' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: historyData } = await userSupabaseClient
            .from("adventure_chat_history")
            .select("role, content")
            .eq("user_id", user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        const chatHistory = (historyData || []).reverse();
        let processedMessage = message;

        if (message?.startsWith("Rolled a ") && chatHistory.length > 0) {
            const lastMsg = chatHistory[chatHistory.length - 1];
            if (lastMsg.role === 'assistant') {
                try {
                    interface AssistantContent {
                        action?: {
                            dc: number;
                            stat: string;
                        };
                    }
                    const lastContent = JSON.parse(lastMsg.content) as AssistantContent;
                    if (lastContent.action?.dc) {
                        const rollValue = parseInt(message.replace("Rolled a ", ""));
                        const dc = lastContent.action.dc;
                        const stat = lastContent.action.stat;
                        const isSuccess = rollValue >= dc;

                        processedMessage = `[ACTION ATTEMPT RESOLUTION] User rolled a ${rollValue} against DC ${dc} (${stat}). RESULT: ${isSuccess ? 'SUCCESS' : 'FAILURE'}. (Raw: ${message})`;
                    }
                } catch 
            }
        }

        await supabaseAdmin.from('adventure_chat_history').insert({ user_id: user.id, role: 'user', content: sanitizedMessage });

        interface ChatMessage {
            role: string;
            content: string;
        }

        const chatHistoryStr = (chatHistory as ChatMessage[]).map((m: ChatMessage) => {
            try {
                interface ParsedMessage {
                    message: string;
                    action?: {
                        stat: string;
                        dc: number;
                    };
                }
                const p = JSON.parse(m.content) as ParsedMessage;
                let line = `${m.role}: ${p.message}`;
                if (p.action?.stat) {
                    line += ` [REQUESTED ROLL: ${p.action.stat} DC ${p.action.dc}]`;
                }
                return line;
            } catch {
                return `${m.role}: ${m.content}`;
            }
        }).join('\n');

        const currentTurnStr = `user: ${processedMessage && processedMessage !== sanitizedMessage ? processedMessage : sanitizedMessage}`;

        interface Reward {
            name: string;
            description: string;
            keywords?: string[];
            slot?: string;
            type?: string;
            stat_buffs?: Record<string, number>;
        }

        let rewardDescription = "Unknown Reward";
        let rewardObj: Reward | null = null;
        try {
            rewardObj = JSON.parse(dungeonState.reward_summary);
            rewardDescription = rewardObj?.description || rewardObj?.name || "Unknown Reward";
        } catch {
            rewardDescription = dungeonState.reward_summary;
        }

        const finalPrompt = ADVENTURE_PROMPT
            .replace('{USER_NAME_HERE}', profile?.full_name || 'Adventurer')
            .replace('{STATS}', statsStr)
            .replace('{INVENTORY}', inventory)
            .replace('{THEME}', dungeonState.theme)
            .replace('{WIN_CONDITION}', dungeonState.win_condition)
            .replace('{REWARD}', rewardDescription)
            .replace('{ITEMS_JSON}', JSON.stringify(dungeonState.dungeon_items || []))
            .replace('{LOCATIONS_JSON}', JSON.stringify(dungeonState.locations || []))
            .replace('{ENEMIES_JSON}', JSON.stringify(dungeonState.enemies || []))
            .replace('{PUZZLES_JSON}', JSON.stringify(dungeonState.puzzles || []))
            .replace('{ADVENTURE_LOG}', chatHistoryStr + '\n' + currentTurnStr);

        interface AIResponse {
            message: string;
            status: string;
            items_found?: string[];
            items_consumed?: string[];
        }
        const result = await callGemini(finalPrompt, true, MODEL_ADVENTURE_INTERACTION, req.signal);
        const aiResponse = result as unknown as AIResponse;

        if (aiResponse.items_found || aiResponse.items_consumed) {
            let itemsChanged = false;
            interface DungeonItem {
                name: string;
                found: boolean;
                consumed: boolean;
            }
            const currentItems = (dungeonState.dungeon_items as DungeonItem[]) || [];

            if (aiResponse.items_found) {
                aiResponse.items_found.forEach((name: string) => {
                    const item = currentItems.find((i: DungeonItem) => i.name === name);
                    if (item && !item.found) {
                        item.found = true;
                        itemsChanged = true;
                    }
                });
            }

            if (aiResponse.items_consumed) {
                aiResponse.items_consumed.forEach((name: string) => {
                    const item = currentItems.find((i: DungeonItem) => i.name === name);
                    if (item && !item.consumed) {
                        item.consumed = true;
                        itemsChanged = true;
                    }
                });
            }

            if (itemsChanged) {
                await supabaseAdmin.from('adventure_states').update({ dungeon_items: currentItems }).eq('user_id', user.id);
            }
        }

        if (aiResponse.status === 'VICTORY') {
            const coinReward = 100 + Math.floor(Math.random() * 101);
            const xpReward = 0;
            await supabaseAdmin.rpc('add_rewards', {
                user_id_input: user.id,
                coin_amount: coinReward,
                xp_amount: xpReward
            });

            // Grant Item
            let itemRewardMsg = "";
            if (rewardObj && rewardObj.name) {
                try {
                    const keywords = rewardObj.keywords || [];
                    const icon = findIconForItem(rewardObj.name, keywords, iconTags);

                    const { data: newItem, error: itemError } = await supabaseAdmin
                        .from('shop_items')
                        .insert({
                            name: rewardObj.name,
                            description: rewardObj.description,
                            cost: 0,
                            slot: rewardObj.slot || 'misc',
                            type: rewardObj.type || 'equippable',
                            stat_buffs: rewardObj.stat_buffs,
                            asset_url: icon,
                            source: 'dungeon_reward'
                        })
                        .select('id')
                        .single();

                    if (newItem && !itemError) {
                        await supabaseAdmin.from('user_items').insert({
                            user_id: user.id,
                            item_id: newItem.id
                        });
                        itemRewardMsg = `\n\n[LOOT OBTAINED: ${rewardObj.name}]`;
                    } else {
                        console.error("Failed to create reward item", itemError);
                    }
                } catch (e) {
                    console.error("Error processing item reward", e);
                }
            }


            await supabaseAdmin.from('adventure_states').delete().eq('user_id', user.id);
            await supabaseAdmin.from('notifications').insert({
                user_id: user.id,
                title: 'Dungeon Cleared!',
                message: `You earned ${coinReward} Coins${rewardObj?.name ? ` and the ${rewardObj.name}` : ''}!`,
                type: 'reward',
                action_link: '/character'
            });

            aiResponse.message += `\n\n[Dungeon Cleared! You earned ${coinReward} Coins.]${itemRewardMsg}`;
        } else if (aiResponse.status === 'DEFEAT') {
            await supabaseAdmin.from('adventure_states').delete().eq('user_id', user.id);
            aiResponse.message += "\n\n[You have been defeated. The dungeon expels you.]";
        }

        await supabaseAdmin.from('adventure_chat_history').insert({ user_id: user.id, role: 'assistant', content: JSON.stringify(aiResponse) });

        return new Response(JSON.stringify(aiResponse), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error(error);
        return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
