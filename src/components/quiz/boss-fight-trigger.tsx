"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Timer } from "lucide-react";
import BossFightDialog from "@/components/quiz/boss-fight-dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ChapterLoader from "@/components/ui/operational/chapter-loader";
import InlineChapterLoader from "@/components/ui/operational/inline-chapter-loader";
import SubscriptionCheckDialog from "../ui/operational/subscription-check-dialog";
import PlanCompletionDialog from "../ui/operational/plan-completion-dialog";
import { useGoPro } from "@/hooks/use-go-pro";

interface BossFightTriggerProps {
  planId: string;
  moduleNumber: number;
  initialCooldownUntil?: string | null;
  initialStoryPlot?: string | null;
}

interface ModuleCompletionResponse {
  message?: string;
  error?: string;
}

interface PlanCompletionResponse {
  is_completed: boolean;
  error?: string;
}

export default function BossFightTrigger({ planId, moduleNumber, initialCooldownUntil, initialStoryPlot }: BossFightTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(initialCooldownUntil ? new Date(initialCooldownUntil) : null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isJourneyComplete, setIsJourneyComplete] = useState(false);
  const [isGeneratingNextChapter, setIsGeneratingNextChapter] = useState(false);
  const [storyPlot, setStoryPlot] = useState<string | null>(initialStoryPlot || null);
  
  const supabase = createClient();
  const router = useRouter();
  const { handleGoPro } = useGoPro();

  const checkStatus = useCallback(async () => {
    try {
        interface BossStatusResponse {
            cooldown_active?: boolean;
            cooldown_until?: string;
            status?: string;
            story_plot?: string;
        }
        const { data: rawData, error } = await supabase.functions.invoke('generate-boss-quiz', {
            body: { plan_id: planId, module_number: moduleNumber }
        });

        const data = rawData as BossStatusResponse;

        if (error) {
            console.error("Error checking boss status:", error.message);
            return;
        }

        if (data?.status === 'defeated') {
             setIsGeneratingNextChapter(true);
        }

        if (data?.story_plot) {
            setStoryPlot(data.story_plot);
        }

        if (data && data.cooldown_active && data.cooldown_until) {
            setCooldownUntil(new Date(data.cooldown_until));
        } else {
            setCooldownUntil(null);
        }
    } catch (e: unknown) {
        const error: Error = e as Error;
        console.error(error.message);
    }
  }, [planId, moduleNumber, supabase]);

  useEffect(() => {
    if (!initialCooldownUntil) {
      checkStatus();
    }
  }, [checkStatus, initialCooldownUntil]);

  useEffect(() => {
    if (!isGeneratingNextChapter) return;

    const pollInterval = setInterval(async () => {
      const { count } = await supabase
        .from('quests')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .eq('module_number', moduleNumber + 1);

      if (count && count > 0) {
        if (!isOpen) {
             router.refresh();
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isGeneratingNextChapter, planId, moduleNumber, router, supabase, isOpen]);

  useEffect(() => {
    if (!cooldownUntil) return;

    const tick = () => {
        const now = new Date();
        const diff = cooldownUntil.getTime() - now.getTime();
        
        if (diff <= 0) {
            setCooldownUntil(null);
            setTimeLeft("");
            checkStatus();
            router.refresh();
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil, checkStatus, router]);

  const handleBossDefeated = async () => {
    setIsGeneratingNextChapter(true);
    try {
        const response = await supabase.functions.invoke('check-module-completion', {
          body: { plan_id: planId, module_number: moduleNumber },
        });
        const data = response.data;
        
        if (data?.message === 'PLAN_COMPLETED') {
             setIsJourneyComplete(true);
             setIsGeneratingNextChapter(false);
        } else if (data?.error === 'SUBSCRIPTION_REQUIRED') {
             setIsSubscriptionDialogOpen(true);
             setIsGeneratingNextChapter(false);
        }
    } catch (e) {
        console.error(e);
        setIsGeneratingNextChapter(false);
    }
  };

  const handleVictory = async () => {
    setIsOpen(false);
    toast.success("Boss Defeated!");
    router.refresh();
  };

  const handleCompletionDialogClose = () => {
    setIsJourneyComplete(false);
    router.refresh();
  };

  const handleRecovery = () => {
      setIsOpen(false);
      checkStatus();
      router.refresh();
  };

  const handleFailure = () => {
      checkStatus();
      router.refresh();
  };

  const handleRenew = async () => {
    setIsLoadingAction(true);
    await handleGoPro();
    setIsLoadingAction(false);
  };

  const handleAbandon = async () => {
    setIsLoadingAction(true);
    try {
       const response = await supabase.functions.invoke('abandon-active-plan');
       const error = response.error;
       if (error) throw error;
       
       toast.success("Path abandoned.");
       router.push('/new-path');
    } catch (error) {
        const err = error as Error;
        console.error("Error abandoning plan:", err.message);
        toast.error("Failed to abandon plan.");
        setIsLoadingAction(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {isProcessing && <ChapterLoader />}
      
      <PlanCompletionDialog 
        isOpen={isJourneyComplete} 
        onClose={handleCompletionDialogClose} 
      />

      <SubscriptionCheckDialog 
        isOpen={isSubscriptionDialogOpen} 
        onClose={() => setIsSubscriptionDialogOpen(false)}
        onRenew={handleRenew}
        isLoading={isLoadingAction}
      />

      <BossFightDialog 
        isOpen={isOpen} 
        onOpenChange={setIsOpen} 
        planId={planId} 
        moduleNumber={moduleNumber} 
        onVictory={handleVictory}
        onBossDefeated={handleBossDefeated}
        onRecovery={handleRecovery}
        onFailure={handleFailure}
      />

      {isGeneratingNextChapter ? (
          <InlineChapterLoader />
      ) : (
        <>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">Chapter Complete</h3>
            <p className="text-muted-foreground max-w-md mx-auto italic leading-relaxed">
                {storyPlot ? `"${storyPlot}"` : "A powerful adversary blocks your path. Prove your mastery of this chapter's lessons to proceed."}
            </p>
          </div>

          {cooldownUntil ? (
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 text-yellow-500 font-bold">
                      <Timer className="h-5 w-5" />
                      <span>Recovery In Progress</span>
                  </div>
                  <p className="text-2xl font-mono">{timeLeft}</p>
                  <p className="text-xs text-muted-foreground">The Oracle is healing your wounds.</p>
              </div>
          ) : (
              <Button 
                size="lg" 
                onClick={() => setIsOpen(true)}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-red-500/20 animate-pulse"
              >
                <Swords className="h-6 w-6" />
                Start Boss Fight
              </Button>
          )}
        </>
      )}
    </div>
  );
}
