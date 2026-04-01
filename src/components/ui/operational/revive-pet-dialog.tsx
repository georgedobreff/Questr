"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skull } from "lucide-react";

interface RevivePetDialogProps {
  revivalProgressSnapshot: number;
  currentCompletedQuests: number;
}

export default function RevivePetDialog({ revivalProgressSnapshot, currentCompletedQuests }: RevivePetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const questsDone = currentCompletedQuests - revivalProgressSnapshot;
  const questsNeeded = 3;
  const remaining = Math.max(0, questsNeeded - questsDone);
  const isReady = remaining === 0;

  const handleRevive = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('revive_pet', {
        p_user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;

      if (data === 'success') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: 'Companion Revived!',
            message: "Your companion has been revived!",
            type: 'success',
            action_link: '/pet'
          });
        }
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error("You are not ready yet.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Revival failed.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full gap-2">
          <Skull className="h-4 w-4" /> Revive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Companion Revival</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              To bring your companion back, you must prove your dedication by completing <strong>3</strong> quests.
            </p>
            <div className="p-4 bg-muted rounded-lg text-center mt-4">
              <p className="text-sm font-medium uppercase text-muted-foreground">Progress</p>
              <p className="text-3xl font-bold">
                {questsDone} / {questsNeeded}
              </p>
              <p className="text-xs text-muted-foreground">Days Completed</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRevive}
            disabled={!isReady || loading}
            variant={isReady ? "default" : "secondary"}
          >
            {loading ? "Reviving..." : (isReady ? "Revive Companion" : "Not Yet Ready")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
