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
import { Lock } from "lucide-react";

interface SubscriptionCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRenew: () => void;
  isLoading?: boolean;
}

export default function SubscriptionCheckDialog({ 
  isOpen, 
  onClose, 
  onRenew, 
  isLoading 
}: SubscriptionCheckDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <Lock className="w-16 h-16 text-amber-500 mb-4" />
            <DialogTitle className="text-2xl font-bold">Subscription Expired</DialogTitle>
            <DialogDescription className="mt-2">
              Your trial has ended. To continue your journey, consult the Oracle, or enter dungeons, you must subscribe.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="py-4 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
                Your progress is saved, but you cannot proceed without an active subscription.
            </p>
        </div>
        <DialogFooter>
            <div className="flex flex-col w-full gap-2">
                <Button onClick={onRenew} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0" disabled={isLoading}>
                    Subscribe Now
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}