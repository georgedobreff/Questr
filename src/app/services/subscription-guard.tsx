"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useGoPro } from "@/hooks/use-go-pro";

interface SubscriptionData {
  status: string | null;
}

interface ProfileData {
  has_had_trial: boolean;
}

interface PetData {
  nickname: string | null;
}

export default function SubscriptionGuard() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [petName, setPetName] = useState("your companion");
  const supabase = createClient();
  const { handleGoPro } = useGoPro();

  useEffect(() => {
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [subRes, profileRes, petRes] = await Promise.all([
        supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("has_had_trial").eq("id", user.id).single(),
        supabase.from("user_pets").select("nickname").eq("user_id", user.id).maybeSingle()
      ]);

      const subData = subRes.data as SubscriptionData | null;
      const profileData = profileRes.data as ProfileData | null;
      const petData = petRes.data as PetData | null;

      const validStatuses = ["active", "trialing", "pro"];
      const isActive = validStatuses.includes(subData?.status || "");
      const hasHadTrial = profileData?.has_had_trial || false;

      setLoading(false);
    };

    checkStatus();
  }, [supabase]);

  if (loading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) return;
      setIsOpen(open);
    }}>
      <DialogContent
        className="sm:max-w-[425px] dialog-card-solid"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
        overlayClassName="bg-background"
      >
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full mb-4">
              <Lock className="w-12 h-12 text-foreground" />
            </div>
            <DialogTitle className="text-3xl font-bold">Journey Paused</DialogTitle>
            <DialogDescription className="mt-4 text-base">
              Your progress is safe and <strong>{petName}</strong> is waiting for your return.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="py-2 text-center">
          <p className="text-muted-foreground">
            Resume your journey to unlock new challenges and keep moving towards your goals.
          </p>
        </div>
        <DialogFooter className="mt-4">
          <Button
            onClick={() => handleGoPro()}
            className="w-full py-6 text-lg bg-orange-500 hover:bg-orange-600 text-white shadow-lg animate-pulsate-orange border-none rounded-full"
          >
            Continue Journey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
