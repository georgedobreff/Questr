"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import PetSelectorDialog from "@/components/character/pet-selector-dialog";

export default function ClientPetWrapper({ isUnlocked }: { isUnlocked: boolean }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div id="pet-container-locked" className="flex flex-col items-center gap-6 text-center">
      <PetSelectorDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />

      <div className="relative w-64 h-64 bg-muted rounded-full flex items-center justify-center overflow-hidden border-4 border-dashed border-muted-foreground/30">
        {/* Silhouette Effect */}
        <div className="absolute inset-0 bg-black/80 z-10 flex items-center justify-center">
          <span className="text-6xl">?</span>
        </div>
        {/* We could put a random pet model here but obscured, for now a question mark is cleaner/faster */}
      </div>

      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-bold">
          {isUnlocked ? "A Companion Awaits!" : "The Wilderness is Hostile"}
        </h2>
        <p className="text-muted-foreground">
          {isUnlocked
            ? "A magical companion is ready to join you."
            : "Complete your first quest to tame a loyal companion."
          }
        </p>

        {isUnlocked ? (
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
            Adopt Companion
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            <Lock className="mr-2 h-4 w-4" /> Locked
          </Button>
        )}
      </div>
    </div>
  );
}
