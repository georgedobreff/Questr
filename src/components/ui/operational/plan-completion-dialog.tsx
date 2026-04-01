"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Award } from "lucide-react";

interface PlanCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlanCompletionDialog({ isOpen, onClose }: PlanCompletionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <Award className="w-16 h-16 text-yellow-500 mb-4" />
            <DialogTitle className="text-2xl font-bold">Path Completed!</DialogTitle>
            <DialogDescription className="mt-2">
              You have successfully completed your Path. Your dedication has been rewarded!
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="py-4 text-center bg-muted rounded-lg">
            <p className="text-lg font-semibold">Rewards:</p>
            <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
              <div className="h-10 w-10 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
                <span className="text-xl">💰</span>
              </div>
              <p className="font-bold text-lg text-yellow-600">Legendary Bounty</p>
              <p>+2000 Coins</p>
            </div>
            <p>+1 Pathfinder's Trophy</p>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">Continue Your Journey</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
