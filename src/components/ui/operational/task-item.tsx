"use client";

import dynamic from 'next/dynamic';
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useGoPro } from "@/hooks/use-go-pro";
import PlanCompletionDialog from "./plan-completion-dialog";
import SubscriptionCheckDialog from "./subscription-check-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";

const DynamicMarkdown = dynamic(() => import('@/components/markdown-renderer'), { ssr: false });

interface TaskItemProps {
  task: {
    id: number;
    quest_id: number;
    title: string;
    short_description: string | null;
    is_completed: boolean;
    reward_coins: number;
  };
  plan_id: number;
  module_number: number;
  day_number: number;
  isLastTaskInQuest?: boolean;
  isLastTaskInModule?: boolean;
}

export default function TaskItem({
  task,
  plan_id,
  module_number,
  day_number,
  isLastTaskInQuest,
  isLastTaskInModule
}: TaskItemProps) {
  const [isCompleted, setIsCompleted] = useState(task.is_completed);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const { handleGoPro } = useGoPro();

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

  const handleOracleHelp = () => {
    const taskDetails = task.short_description ? `\nDetails: ${task.short_description}` : '';
    const message = `Task: ${task.title}${taskDetails}\nI need some guidance with this quest. Provide me with resources and some explanations that will help me learn.`;
    router.push(`/oracle?q=${encodeURIComponent(message)}`);
  };

  const handleStatusChange = async (checked: boolean) => {
    if (!checked && isCompleted) return;
    setLoading(true);
    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: checked })
      .eq("id", task.id);

    if (error) {
      console.error("Error updating task status:", error.message);
      toast.error("Failed to update task status.");
      setIsCompleted(!checked);
      setLoading(false);
      return;
    }

    setIsCompleted(checked);

    if (checked) {

      const coins = task.reward_coins;
      const moduleNum = module_number || 1;
      const baseXp = coins * 10;
      const multiplier = 1.0 + (moduleNum * 0.1);
      const xp = Math.floor(baseXp * multiplier);

      toast.success(`+${coins} Coins, +${xp} XP, +1 AP`);




      if (isLastTaskInQuest && day_number === 6) {
        console.log("Day 6 complete. Pre-generating boss fight...");
        supabase.functions.invoke('generate-boss-quiz', {
          body: { plan_id, module_number }
        }).then((response: { error: { message: string } | null }) => {
          if (response.error) console.error("Pre-generation failed:", response.error.message);
        });
      }
    } else {
      toast.success("Task marked as pending.");
    }

    router.refresh();
    setLoading(false);
  };

  return (
    <>
      <SubscriptionCheckDialog
        isOpen={isSubscriptionDialogOpen}
        onClose={() => setIsSubscriptionDialogOpen(false)}
        onRenew={handleRenew}
        isLoading={isLoadingAction}
      />
      <div className={`flex items-start space-x-4 p-4 titled-cards transition-all duration-300 hover:border-primary/20 group relative ${isCompleted ? 'opacity-70' : ''}`}>
        <div className="relative mt-1 h-5 w-5 shrink-0 group/checkbox">
          <Checkbox
            id={`task-${task.id}`}
            checked={isCompleted}
            onCheckedChange={handleStatusChange}
            disabled={loading || isCompleted}
            className="h-5 w-5 border-muted-foreground data-[state=unchecked]:bg-transparent transition-all rounded-full"
          />
          {!isCompleted && !loading && (
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none text-primary transition-opacity duration-200 ${isTitleHovered ? "opacity-50" : "opacity-0 group-hover/checkbox:opacity-50"}`}>
              <Check className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        <div className="grid gap-1.5 leading-none grow">
          <label
            htmlFor={`task-${task.id}`}
            onMouseEnter={() => setIsTitleHovered(true)}
            onMouseLeave={() => setIsTitleHovered(false)}
            className={`text-base font-bold peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${isCompleted ? "line-through" : ""
              }`}
          >
            <DynamicMarkdown inline>{task.title}</DynamicMarkdown>
          </label>
          {task.short_description && (
            <div className={`text-sm text-foreground leading-relaxed ${isCompleted ? "line-through opacity-70" : ""}`}>

              <DynamicMarkdown>{task.short_description}</DynamicMarkdown>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 rounded-full border border-muted-foreground/20 hover:border-primary/40 tutorial-oracle-btn"
          onClick={handleOracleHelp}
          title="Ask Oracle for help"
        >
          <Sparkles className="h-6 w-6" />
        </Button>      </div>
    </>
  );
}
