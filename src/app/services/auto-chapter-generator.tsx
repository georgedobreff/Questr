"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SubscriptionCheckDialog from "@/components/ui/operational/subscription-check-dialog";
import ChapterLoader from "@/components/ui/operational/chapter-loader";
import { useGoPro } from "@/hooks/use-go-pro";

interface AutoChapterGeneratorProps {
  planId: number;
  lastModuleNumber: number;
}

export default function AutoChapterGenerator({ planId, lastModuleNumber }: AutoChapterGeneratorProps) {
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const { handleGoPro } = useGoPro();

  useEffect(() => {
    const checkCompletion = async () => {
      setIsGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke('check-module-completion', {
          body: { plan_id: planId, module_number: lastModuleNumber },
        });

        if (error) {
          console.error("Error checking module completion:", error);
          return;
        }

        if (data?.error === 'SUBSCRIPTION_REQUIRED') {
          setIsSubscriptionDialogOpen(true);
        } else if (data?.message === 'Module completed. Next module generated.') {
          toast.success("New chapter generated!");
          router.refresh();
        } else if (data?.message === 'Module complete, next module already exists.') {
          router.refresh();
        }
      } catch (error) {
        console.error("Error during auto-generation:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    checkCompletion();
  }, [planId, lastModuleNumber, supabase, router]);

  const handleRenew = async () => {
    setIsLoadingAction(true);
    await handleGoPro();
    setIsLoadingAction(false);
  };

  const handleAbandon = async () => {
    setIsLoadingAction(true);
    try {
      const { error } = await supabase.functions.invoke('abandon-active-plan');
      if (error) throw error;

      toast.success("Path abandoned.");
      router.push('/new-path');
    } catch (error) {
      console.error("Error abandoning plan:", error);
      toast.error("Something went wrong. Try again.");
      setIsLoadingAction(false);
    }
  };

  return (
    <>
      {isGenerating && <ChapterLoader />}
      <SubscriptionCheckDialog
        isOpen={isSubscriptionDialogOpen}
        onClose={() => setIsSubscriptionDialogOpen(false)}
        onRenew={handleRenew}
        isLoading={isLoadingAction}
      />
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
        <p className="text-muted-foreground">Checking for next chapter...</p>
      </div>
    </>
  );
}
