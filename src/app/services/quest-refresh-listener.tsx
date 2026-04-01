"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface QuestRefreshListenerProps {
  planId: number;
}

export default function QuestRefreshListener({ planId }: QuestRefreshListenerProps) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const questChannel = supabase
      .channel(`quest-updates-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quests',
          filter: `plan_id=eq.${planId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    const taskChannel = supabase
      .channel(`task-updates-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(questChannel);
      supabase.removeChannel(taskChannel);
    };
  }, [planId, router, supabase]);

  return null;
}
