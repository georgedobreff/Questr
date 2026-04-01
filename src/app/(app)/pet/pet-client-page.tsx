"use client";

import React, { useState, useEffect } from "react";
import { UserPet, PetMission, UserPetInventoryItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Compass, Heart, Smile, Zap, Play, CheckCircle2, AlertCircle, Clock, Plus, Lock, Coins } from "lucide-react";
import CharacterViewer from "@/components/character/character-viewer";
import PetInventory from "@/app/services/pet-inventory";
import RevivePetDialog from "@/components/ui/operational/revive-pet-dialog";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { animate } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PetClientPageProps {
  initialPet: UserPet;
  initialPetItems: UserPetInventoryItem[];
  initialActiveMission: PetMission | null;
  completedQuestsCount: number;
  isPro: boolean;
  allPetItems: { id: number, name: string }[];
  initialCoins: number;
}

const xpForNextLevel = (level: number) => level * level * 100;

export default function PetClientPage({
  initialPet,
  initialPetItems,
  initialActiveMission,
  completedQuestsCount,
  isPro,
  allPetItems,
  initialCoins,
}: PetClientPageProps) {
  const isMissionOngoingAtStart = initialActiveMission && initialActiveMission.status === 'ongoing';
  const initialTimeLeftAtStart = initialActiveMission ? Math.max(0, initialActiveMission.duration_seconds - (new Date().getTime() - new Date(initialActiveMission.started_at).getTime()) / 1000) : 0;
  const initiallyAway = isMissionOngoingAtStart && initialTimeLeftAtStart > 0;

  const [pet, setPet] = useState<UserPet>(initialPet);
  const [inventoryItems, setInventoryItems] = useState<UserPetInventoryItem[]>(initialPetItems);
  const [activeMission, setActiveMission] = useState<PetMission | null>(initialActiveMission);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [energy, setEnergy] = useState(pet.current_energy);
  const [userCoins, setUserCoins] = useState(initialCoins);
  const [timeLeft, setTimeLeft] = useState<number>(Math.floor(initialTimeLeftAtStart));
  const [isRefillDialogOpen, setIsRefillDialogOpen] = useState(false);
  const [isDeathDialogDismissed, setIsDeathDialogDismissed] = useState(false);


  const [viewerPosition, setViewerPosition] = useState<[number, number, number]>(initiallyAway ? [0, -2.5, 60] : [0, -2.5, 0]);
  const [isFullyAway, setIsFullyAway] = useState(initiallyAway);
  const [viewerAnimation, setViewerAnimation] = useState<string>("idle");
  const [isAnimating, setIsAnimating] = useState(false);


  useEffect(() => {
    setPet(initialPet);
    setInventoryItems(initialPetItems);
    setActiveMission(initialActiveMission);
    setEnergy(initialPet.current_energy);
    setUserCoins(initialCoins);


    if (initialPet.health > 0) {
      setIsDeathDialogDismissed(false);
    }
  }, [initialPet, initialPetItems, initialActiveMission, initialCoins]);

  const supabase = createClient();

  const isMissionActive = activeMission && activeMission.status === 'ongoing';
  const isMissionComplete = activeMission && (activeMission.status === 'completed' || activeMission.status === 'failed');
  const isAway = isMissionActive && timeLeft > 0;


  useEffect(() => {
    const triggerHeartbeat = async () => {
      if (isAway) return;

      const { data, error } = await supabase.rpc('heartbeat_pet_energy', { p_pet_id: pet.id });
      if (!error && data !== null) {
        setEnergy(data);
      }
    };

    triggerHeartbeat();
    const timer = setInterval(triggerHeartbeat, 60000);
    return () => clearInterval(timer);
  }, [pet.id, isAway]);


  useEffect(() => {
    if (activeMission && activeMission.status === 'ongoing') {
      const updateTimer = () => {
        const startedAt = new Date(activeMission.started_at).getTime();
        const now = new Date().getTime();
        const elapsed = (now - startedAt) / 1000;
        const remaining = Math.max(0, activeMission.duration_seconds - elapsed);
        setTimeLeft(Math.floor(remaining));

        if (remaining <= 0 && !resolving) {
          handleResolveMission();
        }
      };

      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [activeMission, resolving]);

  const handleResolveMission = async () => {
    if (!activeMission || resolving) return;
    setResolving(true);
    try {
      const { data, error } = await supabase.functions.invoke('pet-mission-manager', {
        body: { action: 'resolve', missionId: activeMission.id }
      });
      if (!error) setActiveMission(data);
    } catch (e) {
      console.error("Failed to resolve mission", e);
    } finally {
      setResolving(false);
    }
  };

  const refreshMission = async () => {
    const { data } = await supabase
      .from('pet_missions')
      .select('*')
      .eq('pet_id', pet.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setActiveMission(data);
  };

  const refreshInventory = async () => {
    const { data } = await supabase
      .from('user_pet_inventory')
      .select('*, pet_items!inner(*)')
      .eq('user_id', pet.user_id);
    if (data) setInventoryItems(data as unknown as UserPetInventoryItem[]);
  };

  const refreshPet = async () => {
    const { data } = await supabase
      .from('user_pets')
      .select('*, pet_definitions(*)')
      .eq('id', pet.id)
      .single();
    if (data) {
      setPet(data);
      setEnergy(data.current_energy);
    }
  };

  const handleItemUsed = () => {
    refreshPet();
    refreshInventory();
  };



  useEffect(() => {
    if (isAway && !isFullyAway && !isAnimating) {
      setIsAnimating(true);
      setViewerAnimation("walk");
      animate(0, 60, {
        duration: 5,
        onUpdate: (latest) => setViewerPosition([0, -2.5, latest]),
        onComplete: () => {
          setIsFullyAway(true);
          setIsAnimating(false);
        }
      });
    } else if (!isAway && isFullyAway && !isAnimating) {
      setIsAnimating(true);
      setViewerAnimation("walk");
      animate(-60, 0, {
        duration: 5,
        onUpdate: (latest) => setViewerPosition([0, -2.5, latest]),
        onComplete: () => {
          setViewerAnimation("idle");
          setIsFullyAway(false);
          setIsAnimating(false);
        }
      });
    }
  }, [isAway, isFullyAway, isAnimating]);

  const handleRefillEnergy = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          productType: 'pet_energy_refill',
          successUrl: window.location.href,
          cancelUrl: window.location.href,
          mode: 'payment'
        }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to initiate refill purchase.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartMission = async () => {
    if (!selectedDifficulty) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pet-mission-manager', {
        body: { action: 'start', difficulty: selectedDifficulty }
      });

      if (error) throw error;
      setActiveMission(data);


      const coinCost = selectedDifficulty === 'easy' ? 50 : (selectedDifficulty === 'medium' ? 100 : 200);
      setUserCoins(prev => prev - coinCost);

      toast.success("Companion has departed on the mission!");


      const { data: updatedPet } = await supabase
        .from('user_pets')
        .select('*')
        .eq('id', pet.id)
        .single();
      if (updatedPet) setPet({ ...pet, ...updatedPet });

    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to start mission.");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!activeMission) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke('pet-mission-manager', {
        body: { action: 'claim', missionId: activeMission.id }
      });

      if (error) throw error;

      if (data.isSuccess) {
        toast.success(`Mission Successful! Gained ${data.xpGained} XP and ${data.goldGained} Gold.`);
        setUserCoins(prev => prev + data.goldGained);
      } else {
        toast.error("Mission Failed. Better luck next time!");
      }

      setActiveMission(data.mission);
      refreshInventory();


      const { data: updatedPet } = await supabase
        .from('user_pets')
        .select('*, pet_definitions(*)')
        .eq('id', pet.id)
        .single();
      if (updatedPet) setPet(updatedPet);

    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to claim rewards.");
    } finally {
      setClaiming(false);
    }
  };

  const requiredXp = xpForNextLevel(pet.level);
  const xpProgress = (pet.xp / requiredXp) * 100;

  const missionProgress = activeMission ? Math.min(100, (1 - timeLeft / activeMission.duration_seconds) * 100) : 0;

  return (
    <div id="pet-container" className="h-full overflow-y-auto pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 px-4">
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl items-center md:items-start mx-auto">


        <div className="w-full md:w-1/3 flex flex-col items-center">
          <div className="relative w-full rounded-lg">

            <CharacterViewer
              modelPath={pet.pet_definitions.model_path}
              enableControls={false}
              className="h-[290px] w-full rounded-lg"
              disableDefaultLights={false}
              defaultPlaying={false}
              activeAnimationName={viewerAnimation}
              playDeathAnimation={pet.health <= 0}
              position={viewerPosition}
              isPlaying={isAnimating}
              initialCameraPosition={[0, 0, 7]}
              scale={3}
            />

            {isFullyAway && (
              <div className="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in duration-700 z-10">
                <div className="flex flex-col items-center">
                  <Compass className="w-12 h-12 text-primary animate-pulse mb-2" />
                  <p className="text-primary font-bold tracking-widest uppercase text-xs">Exploring...</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 py-2 px-4 text-center rounded-b-lg" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--card-base-shadow)' }}>
              <h1 className="text-lg font-bold tracking-wide">{pet.nickname}</h1>
            </div>
          </div>

          <div className="w-full mt-4">
            <div className="flex justify-between items-baseline">
              <h2 className="text-2xl font-bold">Level {pet.level}</h2>
              <p className="text-sm text-muted-foreground">
                {pet.xp} / {requiredXp} XP
              </p>
            </div>
            <Progress value={xpProgress} className="w-full h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-6">
            <Card className="p-3 flex flex-col items-center text-center">
              <div className="flex justify-between items-center mb-1 w-full">
                <span className="text-xs uppercase font-bold text-muted-foreground">Health</span>
                <Heart className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-lg font-bold">{pet.health}%</div>
              <Progress value={pet.health} className="h-1 mt-1 w-full" />
            </Card>
            <Card className="p-3 flex flex-col items-center text-center">
              <div className="flex justify-between items-center mb-1 w-full">
                <span className="text-xs uppercase font-bold text-muted-foreground">Happiness</span>
                <Smile className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="text-lg font-bold">{pet.happiness}%</div>
              <Progress value={pet.happiness} className="h-1 mt-1 w-full" />
            </Card>
          </div>
        </div>


        <div className="w-full md:w-2/3 space-y-8">


          <Card className="overflow-hidden border-2 border-primary/10">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Compass className="w-6 h-6 text-primary" />
                  Wilderness Exploration
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border shadow-md">
                    <Coins className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-base font-black">{userCoins}</span>
                  </div>
                  <div
                    onClick={() => energy < 100 && setIsRefillDialogOpen(true)}
                    className={cn(
                      "flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border shadow-md transition-colors",
                      energy < 100 ? "cursor-pointer hover:bg-muted" : "cursor-default"
                    )}
                  >
                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-base font-black">{energy}%</span>
                    {energy < 100 && (
                      <div className="ml-1 p-0.5 rounded-full border border-primary/20">
                        <Plus className="w-3 h-3 text-primary" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Explore the wilderness to level up and find loot.
              </p>
            </CardHeader>
            <CardContent>
              {!activeMission || activeMission.status === 'claimed' ? (
                <div className="space-y-6">

                  <div className="grid grid-cols-3 gap-3">
                    {(['easy', 'medium', 'hard'] as const).map((diff) => {
                      const unlocked = (diff === 'easy') || (diff === 'medium' && pet.level >= 5) || (diff === 'hard' && pet.level >= 10);
                      const energyCost = diff === 'easy' ? 50 : (diff === 'medium' ? 70 : 100);
                      const coinCost = diff === 'easy' ? 50 : (diff === 'medium' ? 100 : 200);
                      const duration = diff === 'easy' ? "15m" : (diff === 'medium' ? "45m" : "1.5h");

                      return (
                        <button
                          key={diff}
                          disabled={!unlocked}
                          onClick={() => setSelectedDifficulty(diff)}
                          className={cn(
                            "flex flex-col items-center p-3 rounded-xl border-2 transition-all relative",
                            selectedDifficulty === diff
                              ? "border-primary border-[3px] bg-primary/5 shadow-inner"
                              : "border-primary/10 bg-muted/30 hover:bg-muted/50 hover:border-primary/30",
                            !unlocked && "opacity-50 grayscale cursor-not-allowed"
                          )}
                        >
                          <span className="text-sm font-bold uppercase mb-1">{diff}</span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                            <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            {energyCost}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-0.5">
                            <Coins className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            {coinCost}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {duration}
                          </div>
                          {!unlocked && <Lock className="w-3 h-3 absolute top-1 right-1" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      className="w-max px-12 h-12 text-lg font-bold shadow-lg"
                      disabled={
                        pet.health <= 0 ||
                        !selectedDifficulty ||
                        energy < (selectedDifficulty === 'easy' ? 50 : selectedDifficulty === 'medium' ? 70 : 100) ||
                        userCoins < (selectedDifficulty === 'easy' ? 50 : selectedDifficulty === 'medium' ? 100 : 200) ||
                        loading
                      }
                      onClick={handleStartMission}
                    >
                      {loading ? "Preparing..." : "Begin Exploration"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-primary">{activeMission.mission_title}</h3>
                      <p className="text-sm text-muted-foreground italic">"{activeMission.story_plot}"</p>
                    </div>
                    {isMissionComplete && (
                      <div className={cn(
                        "p-2 rounded-full",
                        activeMission.status === 'completed' ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-red-100 text-red-700 dark:bg-red-900/30"
                      )}>
                        {activeMission.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{isMissionComplete ? " " : "Progress"}</span>
                      <span>{isMissionComplete ? " " : `${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s left`}</span>
                    </div>
                    {isMissionComplete ? (
                      <div className="p-3 bg-muted/30 rounded-lg border border-primary/10 text-center animate-in fade-in zoom-in duration-500">
                        <p className="text-sm font-medium">
                          {activeMission.status === 'completed' ? (
                            <>
                              <span className="text-primary font-bold">{pet.nickname || pet.pet_definitions.name}</span> found{" "}
                              <span className="text-yellow-600 dark:text-yellow-400 font-bold">{activeMission.gold_reward} Gold</span>
                              {(() => {
                                const names: string[] = (activeMission.items_awarded || [])
                                  .map((rewardId: number) => allPetItems.find((i: { id: number; name: string }) => String(i.id) === String(rewardId))?.name)
                                  .filter((name: string | undefined): name is string => !!name);

                                if (names.length === 0) return null;
                                if (names.length === 1) {
                                  return (
                                    <>
                                      {" and "}
                                      <span className="text-primary font-bold">{names[0]}</span>
                                    </>
                                  );
                                }

                                const lastItem: string | undefined = names.pop();
                                return (
                                  <>
                                    {", "}
                                    {names.map((name: string, idx: number) => (
                                      <React.Fragment key={idx}>
                                        <span className="text-primary font-bold">{name}</span>
                                        {idx < names.length - 1 ? ", " : ""}
                                      </React.Fragment>
                                    ))}
                                    {" and "}
                                    <span className="text-primary font-bold">{lastItem}</span>
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              <span className="text-destructive font-bold">{pet.nickname || pet.pet_definitions.name}</span> returned with nothing.
                            </>
                          )}
                        </p>
                      </div>
                    ) : (

                      <Progress value={missionProgress} className="h-3" />
                    )}
                  </div>

                  {isMissionComplete ? (
                    <div className="flex justify-center">
                      <Button
                        className={cn(
                          "w-max px-12 h-12 text-lg font-bold shadow-lg",
                          activeMission.status === 'completed'
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        )}
                        onClick={handleClaimRewards}
                        disabled={claiming}
                      >
                        {claiming ? "Processing..." : (activeMission.status === 'completed' ? "Claim Reward" : "Failed.")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed">
                      <Clock className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-medium">Exploring the realm...</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>


          <div className="titled-cards h-[400px] flex flex-col relative">
            <div className="titled-card-header shrink-0">
              <h2 className="text-lg font-bold tracking-wide">Inventory</h2>
            </div>

            {isAway && (
              <div className="!absolute !inset-0 bg-background !z-30 flex items-center justify-center rounded-lg">
                <div className="titled-cards border-2 border-dashed p-4 rounded-xl flex items-center gap-3 shadow-xl transform -rotate-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-sm">Cannot use items while away</span>
                </div>
              </div>
            )}

            <div className="p-4 pt-5 overflow-y-auto flex-1">
              <PetInventory items={inventoryItems} petAlive={pet.health > 0} onUseSuccess={handleItemUsed} />
            </div>
          </div>

        </div>

      </div>

      <Dialog open={pet.health <= 0 && !isDeathDialogDismissed} onOpenChange={(open) => !open && setIsDeathDialogDismissed(true)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl text-red-600">Your Companion Has Perished</DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <p>
                Your companion has perished due to neglect.
                You still have a chance to bring them back to life.
              </p>
              <p className="text-sm text-muted-foreground">
                Until revived, you cannot send your companion on missions or use items.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <RevivePetDialog
              revivalProgressSnapshot={pet.revival_progress || 0}
              currentCompletedQuests={completedQuestsCount}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRefillDialogOpen} onOpenChange={setIsRefillDialogOpen}>
        <DialogContent className="dialog-card-glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              Energy Refill
            </DialogTitle>
            <DialogDescription className="pt-4">
              Your companion is tired from their travels. Purchase an <strong>Instant Refill</strong> potion to restore their energy to 100%.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 p-4 rounded-lg border border-dashed flex flex-col items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Current Energy</span>
            <span className="text-4xl font-black text-primary">{energy}%</span>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button variant="outline" onClick={() => setIsRefillDialogOpen(false)}>Maybe Later</Button>
            <Button
              onClick={handleRefillEnergy}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-white border-0"
            >
              {loading ? "Preparing..." : "Buy Refill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
