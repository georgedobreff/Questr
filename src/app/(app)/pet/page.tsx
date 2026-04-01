import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientPetWrapper from "./client-pet-wrapper";
import PetClientPage from "./pet-client-page";
import { UserPet, PetMission, UserPetInventoryItem } from "@/lib/types";

export default async function PetPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [petRes, questsRes, itemsRes, subRes, missionRes, allItemsRes, profileRes] = await Promise.all([
    supabase.from("user_pets").select("*, pet_definitions(*)").eq("user_id", user.id).maybeSingle(),
    supabase.from("quests").select("id, module_number, day_number, tasks(is_completed), plans!inner(user_id)").eq("plans.user_id", user.id),
    supabase.from("user_pet_inventory").select("*, pet_items!inner(*)").eq("user_id", user.id),
    supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
    supabase.from("pet_missions").select("*").eq("user_id", user.id).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pet_items").select("id, name"),
    supabase.from("profiles").select("coins").eq("id", user.id).single()
  ]);

  const userPet = petRes.data as UserPet | null;
  const quests = questsRes.data;
  const petItems = (itemsRes.data || []) as unknown as UserPetInventoryItem[];
  const isPro = ["active", "trialing", "pro"].includes(subRes.data?.status || "");
  const activeMission = missionRes.data as PetMission | null;
  const allPetItems = (allItemsRes.data || []) as { id: number, name: string }[];

  let completedQuestsCount = 0;
  let isDayOneCompleted = false;

  if (quests) {
    const typedQuests = quests as { module_number: number, day_number: number, tasks: { is_completed: boolean }[] }[];

    completedQuestsCount = typedQuests.filter(q =>
      q.tasks.length > 0 && q.tasks.every(t => t.is_completed)
    ).length;

    isDayOneCompleted = typedQuests.some(q =>
      q.module_number === 1 &&
      q.day_number === 1 &&
      q.tasks.length > 0 &&
      q.tasks.every(t => t.is_completed)
    );
  }

  const isUnlocked = isDayOneCompleted;

  if (!userPet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 p-4 pt-24">
        <ClientPetWrapper isUnlocked={isUnlocked} />
      </div>
    );
  }

  return (
    <PetClientPage
      initialPet={userPet}
      initialPetItems={petItems}
      initialActiveMission={activeMission}
      completedQuestsCount={completedQuestsCount}
      isPro={isPro}
      allPetItems={allPetItems}
      initialCoins={profileRes.data?.coins || 0}
    />
  );
}