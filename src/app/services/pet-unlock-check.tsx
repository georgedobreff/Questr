"use client";

import { useEffect, useState } from "react";
import PetSelectorDialog from "@/components/character/pet-selector-dialog";
import { createClient } from "@/lib/supabase/client";

interface PetUnlockCheckProps {
  hasCompletedFirstModule: boolean;
  hasPet: boolean;
}

export default function PetUnlockCheck({ hasCompletedFirstModule, hasPet }: PetUnlockCheckProps) {
  const supabase = createClient();
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (hasCompletedFirstModule && !hasPet) {
        const timer = setTimeout(async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    title: 'Companion Unlocked!',
                    message: "Congratulations! You've unlocked a Companion!",
                    type: 'success',
                    action_link: '/pet'
                });
            }
            setShowDialog(true);
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [hasCompletedFirstModule, hasPet]);

  return (
    <PetSelectorDialog 
      isOpen={showDialog} 
      onOpenChange={setShowDialog} 
    />
  );
}
