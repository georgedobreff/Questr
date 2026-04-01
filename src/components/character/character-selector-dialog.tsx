"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CharacterViewer from "@/components/character/character-viewer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const characterModels = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r"
].map(id => `/assets/3d-models/characters/character-${id}.glb`);

interface CharacterSelectorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
}

export default function CharacterSelectorDialog({ isOpen, onOpenChange, onSuccess }: CharacterSelectorDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const handlePrevCharacter = () => {
    setSelectedCharacterIndex((prev) => (prev - 1 + characterModels.length) % characterModels.length);
  };

  const handleNextCharacter = () => {
    setSelectedCharacterIndex((prev) => (prev + 1) % characterModels.length);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to change your appearance.");

      const newModelPath = characterModels[selectedCharacterIndex];

      const { error } = await supabase
        .from('profiles')
        .update({ character_model_path: newModelPath })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Appearance updated!");
      onSuccess();
      onOpenChange(false);

    } catch (error) {
      const err = error as Error;
      toast.error(err.message);
      console.error("Appearance change error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-card-solid">
        <DialogHeader>
          <DialogTitle>Change Your Appearance</DialogTitle>
          <DialogDescription>
            Select a new character.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <CharacterViewer
            modelPath={characterModels[selectedCharacterIndex]}
            autoRotate={true}
          />
          <div className="flex justify-between">
            <Button onClick={handlePrevCharacter}><ChevronLeft /></Button>
            <Button onClick={handleNextCharacter}><ChevronRight /></Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
