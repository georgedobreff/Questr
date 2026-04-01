"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function ActivityTracker() {
  const supabase = createClient();

  useEffect(() => {
    const updateActivity = async () => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await supabase.rpc('update_activity', { p_timezone: timezone });
        }
      } catch (error) {
        console.error("Failed to update activity:", error);
      }
    };
    updateActivity();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session?.user) {
        updateActivity();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return null;
}
