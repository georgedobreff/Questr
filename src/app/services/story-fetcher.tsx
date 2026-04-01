"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Plan, Quest } from "@/lib/types";

interface StoryFetcherProps {
  activePlan: Plan;
  moduleNumber: number;
}

export default function StoryFetcher({ activePlan, moduleNumber }: StoryFetcherProps) {
  const supabase = createClient();

  useEffect(() => {
    const generateInitialStories = async () => {
      if (
        activePlan &&
        moduleNumber === 1 &&
        activePlan.quests
      ) {
        const firstModuleQuests = activePlan.quests.filter(
          (q: Quest) => q.module_number === 1
        );

        const questsMissingStories = firstModuleQuests.filter(
          (q: Quest) => !q.story && q.day_number > 1
        );

        if (questsMissingStories.length > 0) {
            const quest_ids = questsMissingStories.map((q: Quest) => q.id);
            const { data: planData } = await supabase.from('plans').select('plot').eq('id', activePlan.id).single();
            const plot = planData?.plot || '';
            const { data: prevQuests } = await supabase
              .from('quests')
              .select('story')
              .eq('plan_id', activePlan.id)
              .eq('module_number', 1)
              .order('day_number');

            const historical_context = (prevQuests as { story: string | null }[] | null)?.map((q) => q.story).filter(Boolean).join('\n\n') || "The journey has just begun.";

            await supabase.functions.invoke('generate-quest-stories', {
              body: JSON.stringify({
                plan_id: activePlan.id,
                quest_ids,
                historical_context,
                plot
              }),
            });
        }
      }
    };

    generateInitialStories();
  }, [activePlan, moduleNumber, supabase]);

  return null;
}
