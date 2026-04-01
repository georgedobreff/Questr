import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callGemini } from "../_shared/llm.ts";
import { MODEL_PET_MISSION_NARRATIVE } from "../_shared/llm_config.ts";
import { PET_MISSION_GENERATOR_PROMPT } from "../_shared/prompts.ts";

interface MissionNarrative {
  mission_title: string;
  story_plot: string;
  success_story: string;
  failure_story: string;
}

interface PetData {
  id: string;
  nickname: string;
  pet_def_id: string;
  level: number;
  xp: number;
  current_energy: number;
  last_energy_refill_at: string;
  pet_definitions: {
    name: string;
  };
}

function getSuccessChance(level: number, difficulty: string): number {
  const cappedLevel = Math.min(15, level);
  let startChance: number;
  let capChance: number;

  if (difficulty === 'easy') {
    startChance = 0.70;
    capChance = 0.95;
  } else if (difficulty === 'medium') {
    startChance = 0.55;
    capChance = 0.90;
  } else {
    startChance = 0.40;
    capChance = 0.80;
  }

  if (cappedLevel >= 15) return capChance;

  const progress = (cappedLevel - 1) / 14.0;
  return startChance + (capChance - startChance) * progress;
}

function getXPRequirement(level: number): number {
  return level * level * 100;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, difficulty, missionId }: { action: 'start' | 'claim' | 'resolve', difficulty?: 'easy' | 'medium' | 'hard', missionId?: string } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    if (action === 'start') {
      if (!difficulty) throw new Error('Difficulty is required for starting a mission.');

      const { data: pet, error: petError } = await supabaseAdmin
        .from('user_pets')
        .select('*, pet_definitions(name)')
        .eq('user_id', user.id)
        .eq('status', 'alive')
        .single();

      if (petError || !pet) throw new Error('No active pet found.');
      const petData = pet as unknown as PetData;

      if (difficulty === 'medium' && petData.level < 5) throw new Error('Medium missions unlock at Level 5.');
      if (difficulty === 'hard' && petData.level < 10) throw new Error('Hard missions unlock at Level 10.');

      const { data: activeMission } = await supabaseAdmin
        .from('pet_missions')
        .select('id')
        .eq('pet_id', petData.id)
        .eq('status', 'ongoing')
        .maybeSingle();

      if (activeMission) throw new Error('Companion is already on a mission.');

      const { data: currentEnergy, error: energyError } = await supabaseAdmin.rpc('get_pet_energy', { p_pet_id: petData.id });
      if (energyError) throw energyError;

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('coins')
        .eq('id', user.id)
        .single();
      if (profileError || !profile) throw new Error('Could not fetch user profile.');

      const energyCost = difficulty === 'easy' ? 50 : (difficulty === 'medium' ? 70 : 100);
      const coinCost = difficulty === 'easy' ? 50 : (difficulty === 'medium' ? 100 : 200);

      if (currentEnergy < energyCost) throw new Error(`Not enough energy. Need ${energyCost}, have ${currentEnergy}.`);
      if (profile.coins < coinCost) throw new Error(`Not enough coins. Need ${coinCost}, have ${profile.coins}.`);

      const prompt = PET_MISSION_GENERATOR_PROMPT
        .replace('{PET_NAME}', petData.nickname || petData.pet_definitions.name)
        .replace('{PET_TYPE}', petData.pet_definitions.name)
        .replace('{DIFFICULTY}', difficulty);

      const narrative = await callGemini(prompt, true, MODEL_PET_MISSION_NARRATIVE) as unknown as MissionNarrative;

      await supabaseAdmin.rpc('spend_pet_energy', { p_pet_id: petData.id, p_amount: energyCost });
      await supabaseAdmin.rpc('increment_profile_coins', { p_user_id: user.id, p_amount: -coinCost });

      const duration = difficulty === 'easy' ? 900 : (difficulty === 'medium' ? 2700 : 5400);
      const xpReward = difficulty === 'easy' ? 50 : (difficulty === 'medium' ? 150 : 400);
      const goldReward = difficulty === 'easy' ? Math.floor(Math.random() * 20) + 10 :
        (difficulty === 'medium' ? Math.floor(Math.random() * 50) + 30 :
          Math.floor(Math.random() * 100) + 70);

      const { data: newMission, error: missionError } = await supabaseAdmin
        .from('pet_missions')
        .insert({
          user_id: user.id,
          pet_id: petData.id,
          difficulty,
          duration_seconds: duration,
          mission_title: narrative.mission_title,
          story_plot: narrative.story_plot,
          success_story: narrative.success_story,
          failure_story: narrative.failure_story,
          xp_reward: xpReward,
          gold_reward: goldReward,
          status: 'ongoing'
        })
        .select()
        .single();

      if (missionError) throw missionError;

      return new Response(JSON.stringify(newMission), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'resolve') {
      if (!missionId) throw new Error('Mission ID is required.');

      const { data: mission, error: missionError } = await supabaseAdmin
        .from('pet_missions')
        .select('*, user_pets(*, pet_definitions(name))')
        .eq('id', missionId)
        .eq('user_id', user.id)
        .single();

      if (missionError || !mission) throw new Error('Mission not found.');
      if (mission.status !== 'ongoing') return new Response(JSON.stringify(mission), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const pet = mission.user_pets as unknown as PetData;
      const successChance = getSuccessChance(pet.level, mission.difficulty);
      const isSuccess = Math.random() < successChance;

      let awardedItems: number[] = [];
      if (isSuccess) {
        const { data: allPetItems } = await supabaseAdmin
          .from('pet_items')
          .select('id, name, pet_species');

        const rawItems = (allPetItems || []) as { id: number; name: string; pet_species: string[] | null }[];

        const validItems = rawItems.filter(item => {
          const isUniversal = !item.pet_species || item.pet_species.length === 0;
          const isSpeciesMatch = item.pet_species && item.pet_species.includes(pet.pet_def_id);
          return isUniversal || isSpeciesMatch;
        });

        const getRandomItem = () => {
          if (validItems.length === 0) return 1;
          return validItems[Math.floor(Math.random() * validItems.length)].id;
        };

        if (mission.difficulty === 'easy') {
          awardedItems.push(getRandomItem());
        } else if (mission.difficulty === 'medium') {
          awardedItems.push(getRandomItem());
          if (Math.random() < 0.35) awardedItems.push(getRandomItem());
        } else {
          awardedItems.push(getRandomItem());
          awardedItems.push(getRandomItem());
          if (Math.random() < 0.05) {
            const { data: energyPotion } = await supabaseAdmin
              .from('pet_items')
              .select('id')
              .eq('is_full_energy_refill', true)
              .single(); if (energyPotion) awardedItems.push(energyPotion.id);
          }
        }
      }

      const { data: updatedMission } = await supabaseAdmin
        .from('pet_missions')
        .update({
          status: isSuccess ? 'completed' : 'failed',
          items_awarded: awardedItems
        })
        .eq('id', missionId)
        .select()
        .single();

      return new Response(JSON.stringify(updatedMission), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'claim') {
      if (!missionId) throw new Error('Mission ID is required for claiming rewards.');

      const { data: mission, error: missionError } = await supabaseAdmin
        .from('pet_missions')
        .select('*, user_pets(*, pet_definitions(name))')
        .eq('id', missionId)
        .eq('user_id', user.id)
        .single();

      if (missionError || !mission) throw new Error('Mission not found.');

      const pet = mission.user_pets as unknown as PetData;
      const isSuccess = mission.status === 'completed';

      let awardedItems = mission.items_awarded || [];
      let finalXp = 0;
      let finalGold = 0;

      if (isSuccess) {
        finalXp = mission.xp_reward;
        finalGold = mission.gold_reward;

        await supabaseAdmin.rpc('sync_pet_energy', { p_pet_id: pet.id });

        await supabaseAdmin.rpc('increment_profile_coins', { p_user_id: user.id, p_amount: finalGold });
        let newXp = pet.xp + finalXp;
        let newLevel = pet.level;
        let xpReq = getXPRequirement(newLevel);
        while (newXp >= xpReq) {
          newXp -= xpReq;
          newLevel++;
          xpReq = getXPRequirement(newLevel);
        }
        await supabaseAdmin.from('user_pets').update({ xp: newXp, level: newLevel }).eq('id', pet.id);

        for (const itemId of awardedItems) {
          await supabaseAdmin.rpc('purchase_pet_item_internal', { p_user_id: user.id, p_pet_item_id: itemId });
        }
      } else {
        await supabaseAdmin.rpc('sync_pet_energy', { p_pet_id: pet.id });
      }

      const { data: updatedMission } = await supabaseAdmin
        .from('pet_missions')
        .update({ status: 'claimed' })
        .eq('id', missionId)
        .select()
        .single();

      return new Response(JSON.stringify({
        mission: updatedMission,
        isSuccess,
        xpGained: finalXp,
        goldGained: finalGold,
        itemsGained: awardedItems
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid action.');

  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});