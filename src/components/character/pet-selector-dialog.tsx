"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import CharacterViewer from "./character-viewer";

interface PetDefinition {
  id: number;
  name: string;
  model_path: string;
}

export default function PetSelectorDialog({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const [pets, setPets] = useState<PetDefinition[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      const fetchPets = async () => {
        const { data } = await supabase.from('pet_definitions').select('*').order('id');
        if (data) setPets(data as PetDefinition[]);
      };
      fetchPets();
    }
  }, [isOpen, supabase]);

  const handleAdopt = async () => {
    const selectedPet = pets[selectedIndex];
    if (!selectedPet) return;

    if (!nickname) {
      toast.error("Please name your companion.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('adopt_pet', {
        p_pet_def_id: selectedPet.id,
        p_nickname: nickname
      });
      if (error) throw error;
      
      toast.success(`${nickname} is now your companion!`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to adopt pet.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => setSelectedIndex((prev) => (prev - 1 + pets.length) % pets.length);
  const handleNext = () => setSelectedIndex((prev) => (prev + 1) % pets.length);

  const currentPet = pets[selectedIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Choose Your Companion</DialogTitle>
          <DialogDescription>
            Select a loyal friend to join your journey.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          {currentPet && (
            <div className="flex flex-col gap-4">
              <div className="relative h-64 w-full dialog-card-solid rounded-md overflow-hidden border">
                 <CharacterViewer 
                    key={currentPet.model_path} 
                    modelPath={currentPet.model_path}
                 />
              </div>
              
              <div className="flex items-center justify-between px-4">
                <Button variant="outline" size="icon" onClick={handlePrev}>&lt;</Button>
                <div className="font-bold text-lg">{currentPet.name}</div>
                <Button variant="outline" size="icon" onClick={handleNext}>&gt;</Button>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="nickname">Name your companion</Label>
            <Input 
              id="nickname" 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Rex"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleAdopt} disabled={loading || !currentPet}>
            {loading ? "Adopting..." : "Adopt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
