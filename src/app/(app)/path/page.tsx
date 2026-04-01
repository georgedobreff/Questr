import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PetUnlockCheck from "@/app/services/pet-unlock-check";
import StoryFetcher from "@/app/services/story-fetcher";
import SubscriptionOverlay from "@/components/ui/operational/subscription-overlay";
import ProceduralMap from "@/components/ui/operational/procedural-map";
import type { Plan, Quest, Task } from "@/lib/types";

const isQuestComplete = (quest: Quest) => {
  return quest.tasks && quest.tasks.length > 0 && quest.tasks.every((task: Task) => task.is_completed);
};

export default async function PathPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [plansRes, petsRes, subRes] = await Promise.all([
    supabase
      .from("plans")
      .select("*, plot, quests(*, story, tasks(*))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("user_pets").select("id").eq("user_id", user.id),
    supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle()
  ]);

  const { data: allPlans, error: plansError } = plansRes;
  const { data: userPets } = petsRes;
  const isPro = ["active", "trialing", "pro"].includes(subRes.data?.status || "");

  if (plansError) {
    console.error("Error fetching plans:", plansError);
    return <p className="text-red-500">Error loading plans.</p>;
  }

  const activePlan = (allPlans as Plan[]).length > 0 ? allPlans[0] : null;
  const hasPet = (userPets?.length ?? 0) > 0;

  let activeModule: { module_number: number, quests: Quest[] } | null = null;
  let completedModules: { module_number: number, quests: Quest[] }[] = [];

  if (activePlan) {
    const questsByModule = (activePlan.quests || []).reduce((acc: Record<number, Quest[]>, quest: Quest) => {
      const moduleNum = quest.module_number;
      if (!acc[moduleNum]) {
        acc[moduleNum] = [];
      }
      acc[moduleNum].push(quest);
      return acc;
    }, {});

    const sortedModuleNumbers = Object.keys(questsByModule).map(Number).sort((a, b) => a - b);

    const activeModuleNumber = sortedModuleNumbers.find((moduleNumber: number) => {
      const tasksInModule = questsByModule[moduleNumber].flatMap((q: Quest) => q.tasks);
      return tasksInModule.some((t: Task) => !t.is_completed);
    });

    completedModules = sortedModuleNumbers
      .filter((moduleNumber: number) => {
        const tasksInModule = questsByModule[moduleNumber].flatMap((q: Quest) => q.tasks);
        return tasksInModule.length > 0 && tasksInModule.every((t: Task) => t.is_completed);
      })
      .map((moduleNumber: number) => ({ module_number: moduleNumber, quests: questsByModule[moduleNumber] }));

    if (activeModuleNumber !== undefined) {
      activeModule = { module_number: activeModuleNumber, quests: questsByModule[activeModuleNumber] };
    }
  }

  const hasCompletedFirstModule = completedModules.length > 0;

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center overflow-hidden`}>
      <PetUnlockCheck hasCompletedFirstModule={hasCompletedFirstModule} hasPet={hasPet} />

      {activePlan && activeModule && (
        <StoryFetcher activePlan={activePlan} moduleNumber={activeModule.module_number} />
      )}

      {!activePlan ? (
        <div className="flex flex-col items-center justify-center flex-grow gap-4">
          <p>No active Journey.</p>
          <Link href="/new-path">
            <Button>Begin a New Journey</Button>
          </Link>
        </div>
      ) : (
        <div id="map-container" className="w-full h-full relative">
          <ProceduralMap
            plan={activePlan}
            completedModules={completedModules.map((m: { module_number: number }) => m.module_number)}
            activeModuleNumber={activeModule?.module_number || 1}
          />
        </div>
      )}
    </div>
  );
}
