import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import InventoryManager from "@/app/services/inventory-manager";
import CharacterViewer from "@/components/character/character-viewer";
import AchievementsList from "@/components/character/achievements-list";
import StatsManager from "@/app/services/stats-manager";
import type { EquippedItem, UserItem, UserStat, Profile } from "@/lib/types";
import type { PostgrestError } from "@supabase/supabase-js";


const xpForNextLevel = (level: number) => Math.floor(100 * Math.pow(level, 1.5));

export default async function CharacterPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  await supabase.rpc('check_achievements', { user_id_input: user.id });


  const [profileRes, equippedItemsRes, userItemsRes, latestPlanRes, achievementsRes, userAchievementsRes] = await Promise.all([
    supabase.from("profiles").select("*, skill_points").eq("id", user.id).single(),
    supabase.from("equipped_items").select("*, shop_items(*)").eq("user_id", user.id),
    supabase.from("user_items").select("*, shop_items!inner(*)").eq("user_id", user.id).neq("shop_items.type", "pet_consumable"),
    supabase.from("plans").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("achievements").select("*").order("category").order("reward_xp"),
    supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id)
  ]);

  const latestPlanId = latestPlanRes.data?.id;


  const userStatsRes = latestPlanId
    ? await supabase.from("user_stats").select("*").eq("user_id", user.id).eq("plan_id", latestPlanId).order("name")
    : { data: null, error: null };

  const { data: profile, error: profileError } = profileRes as { data: Profile & { skill_points: number } | null, error: PostgrestError | null };
  const { data: equippedItems, error: equippedItemsError } = equippedItemsRes as { data: EquippedItem[] | null, error: PostgrestError | null };
  const { data: userItems, error: userItemsError } = userItemsRes as { data: UserItem[] | null, error: PostgrestError | null };
  const { data: userStats, error: userStatsError } = userStatsRes as { data: UserStat[] | null, error: PostgrestError | null };
  const { data: achievements, error: achievementsError } = achievementsRes;
  const { data: userAchievements, error: userAchievementsError } = userAchievementsRes as { data: { achievement_id: number }[] | null, error: PostgrestError | null };

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    return <p className="text-red-500">Error loading character profile.</p>;
  }
  if (equippedItemsError || userItemsError || userStatsError || achievementsError || userAchievementsError) {
    console.error({ equippedItemsError, userItemsError, userStatsError, achievementsError, userAchievementsError });
    return <p className="text-red-500">Error loading character data.</p>;
  }


  const unlockedSet = new Set(userAchievements?.map((ua: { achievement_id: number }) => ua.achievement_id));
  const sortedAchievements = achievements ? [...achievements].sort((a: { id: number }, b: { id: number }) => {
    const aUnlocked = unlockedSet.has(a.id);
    const bUnlocked = unlockedSet.has(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return 0;
  }) : [];


  const statsMap = new Map<string, { baseValue: number, buff: number }>();
  (userStats || []).forEach((stat: UserStat) => {
    statsMap.set(stat.name, { baseValue: stat.value, buff: 0 });
  });

  (equippedItems || []).forEach((equippedItem: EquippedItem) => {
    const buffs = equippedItem.shop_items?.stat_buffs;
    if (buffs) {
      for (const [statName, buffValue] of Object.entries(buffs)) {
        const value = buffValue as number;
        const existingStat = statsMap.get(statName);
        if (existingStat) {
          existingStat.buff += value;
        } else {
          statsMap.set(statName, { baseValue: 0, buff: value });
        }
      }
    }
  });

  const finalStats = Array.from(statsMap.entries()).map(([name, { baseValue, buff }]: [string, { baseValue: number, buff: number }]) => ({
    name,
    value: baseValue + buff,
    buff,
  }));


  const requiredXp = xpForNextLevel(profile.level);
  const progressPercentage = (profile.xp / requiredXp) * 100;
  const characterModel = profile.character_model_path || '/assets/3d-models/characters/character-a.glb';

  return (
    <div className="h-full overflow-y-auto pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 px-4">
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl items-center md:items-start mx-auto">

        <div className="w-full md:w-1/3 flex flex-col items-center">
          <div className="relative w-full rounded-lg">
            <CharacterViewer
              modelPath={characterModel}
              enableControls={false}
              className="h-[285px] w-full rounded-lg"
              disableDefaultLights={false}
              defaultPlaying={false}
              activeAnimationName="idle"
              initialCameraPosition={[0, 0.4, 7]}
              position={[0, -4.3, 0]}
              scale={3}
            />
            <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 py-2 px-4 text-center rounded-b-lg" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--card-base-shadow)' }}>
              <h1 className="text-lg font-bold tracking-wide">{profile.full_name || "Adventurer"}</h1>
            </div>
          </div>
          <div className="w-full mt-4">
            <div className="flex justify-between items-baseline">
              <h2 className="text-2xl font-bold">Level {profile.level}</h2>
              <p className="text-sm text-muted-foreground">
                {profile.xp} / {requiredXp} XP
              </p>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>

          <div className="hidden md:block w-full mt-8">
            <div className="titled-cards h-[320px] flex flex-col relative">
              <div className="titled-card-header shrink-0">
                <h2 className="text-lg font-bold tracking-wide">Achievements</h2>
              </div>
              <div className="p-4 pt-6 overflow-y-auto flex-1">
                <AchievementsList
                  achievements={sortedAchievements}
                  unlockedIds={unlockedSet}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-2/3 space-y-8">
          <StatsManager
            initialStats={finalStats}
            initialSkillPoints={profile.skill_points || 0}
          />

          <div className="titled-cards h-[400px] flex flex-col relative">
            <div className="titled-card-header shrink-0">
              <h2 className="text-lg font-bold tracking-wide">Inventory</h2>
            </div>
            <div className="p-4 pt-5 overflow-y-auto flex-1">
              {(userItems && userItems.length > 0) ? (
                <InventoryManager userItems={userItems} equippedItems={equippedItems || []} />
              ) : (
                <p className="text-muted-foreground text-center py-10">Your inventory is empty. Explore the Dungeon to find some loot!</p>
              )}
            </div>
          </div>
        </div>

        <div className="block md:hidden w-full mt-8">
          <div className="titled-cards h-[320px] flex flex-col relative">
            <div className="titled-card-header shrink-0">
              <h2 className="text-lg font-bold tracking-wide">Achievements</h2>
            </div>
            <div className="p-4 pt-6 overflow-y-auto flex-1">
              <AchievementsList
                achievements={sortedAchievements}
                unlockedIds={unlockedSet}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
