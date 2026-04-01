import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import TaskItem from "@/components/ui/operational/task-item";
import BossFightTrigger from "@/components/quiz/boss-fight-trigger";
import type { Plan, Quest, Task } from "@/lib/types";
import QuestRefreshListener from "@/app/services/quest-refresh-listener";
import StoryFetcher from "@/app/services/story-fetcher";
import { Progress } from "@/components/ui/progress";
import InlineChapterLoader from "@/components/ui/operational/inline-chapter-loader";
import { NotesCard } from "@/components/ui/operational/notes-card";
import { getUserNotes } from "@/app/actions/note-actions";

export default async function LogPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: allPlans, error: plansError } = await supabase
    .from("plans")
    .select("*, quests(*, tasks(*))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (plansError) {
    console.error("Error fetching plans:", plansError);
    return <p className="text-red-500">Error loading quests.</p>;
  }


  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_generations_count, purchased_plan_credits")
    .eq("id", user.id)
    .single();

  const [subscriptionRes, notesRes] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("user_id", user.id).single(),
    getUserNotes()
  ]);
  const subscription = subscriptionRes.data;
  const notes = notesRes;

  const planGenerationsCount = profile?.plan_generations_count || 0;
  const purchasedPlanCredits = profile?.purchased_plan_credits || 0;
  const subscriptionStatus = subscription?.status || 'free';
  const isPro = ['active', 'trialing', 'pro'].includes(subscriptionStatus);
  const newPlanVariantId = process.env.NEW_PLAN_PRODUCT;

  const activePlan = (allPlans as Plan[]).length > 0 ? allPlans[0] : null;

  const { data: bossFights } = activePlan ? await supabase
    .from("boss_fights")
    .select("module_number, status, cooldown_until, story_plot")
    .eq("plan_id", activePlan.id)
    .eq("user_id", user.id) : { data: null };

  let currentDayQuest: Quest | null = null;
  let uncompletedTasksInModule = 0;
  let lastModuleNumber = -1;
  let initialCooldownUntil: string | null = null;
  let initialStoryPlot: string | null = null;
  let totalTasksInModule = 0;
  let completedTasksInModule = 0;
  let isWaitingForNextChapter = false;
  let isPlanComplete = false;
  let activeModuleNumber = -1;

  if (activePlan) {
    const questsByModule = (activePlan.quests || []).reduce((acc: Record<number, Quest[]>, quest: Quest) => {
      const moduleNum = quest.module_number;
      if (!acc[moduleNum]) {
        acc[moduleNum] = [];
      }
      acc[moduleNum].push(quest);
      return acc;
    }, {});

    const sortedModuleNumbers = Object.keys(questsByModule).map((n: string) => Number(n)).sort((a: number, b: number) => a - b);

    activeModuleNumber = -1;
    for (const moduleNumber of sortedModuleNumbers) {
      const tasksInModule = questsByModule[moduleNumber].flatMap((q: Quest) => q.tasks);
      const uncompletedCount = tasksInModule.filter((t: Task) => !t.is_completed).length;

      const bossForModule = bossFights?.find(f => f.module_number === moduleNumber);
      const isBossDefeated = bossForModule?.status === 'defeated';

      if (uncompletedCount > 0) {
        activeModuleNumber = moduleNumber;
        uncompletedTasksInModule = uncompletedCount;
        totalTasksInModule = tasksInModule.length;
        completedTasksInModule = totalTasksInModule - uncompletedCount;
        break;
      } else if (!isBossDefeated) {
        lastModuleNumber = moduleNumber;
        activeModuleNumber = -1;

        if (bossForModule) {
          initialStoryPlot = bossForModule.story_plot;
          if (bossForModule.status === 'failed' && bossForModule.cooldown_until) {
            const now = new Date();
            const cooldown = new Date(bossForModule.cooldown_until);
            if (now < cooldown) {
              initialCooldownUntil = bossForModule.cooldown_until;
            }
          }
        }
        break;
      }
    }

    if (activeModuleNumber !== -1) {
      const activeQuests = (questsByModule[activeModuleNumber] || []).sort((a: Quest, b: Quest) => a.day_number - b.day_number);
      for (const quest of activeQuests) {
        if (quest.tasks.length === 0 || quest.tasks.some((t: Task) => !t.is_completed)) {
          currentDayQuest = quest;
          break;
        }
      }


      if (currentDayQuest) {
        lastModuleNumber = -1;
      }
    } else if (lastModuleNumber === -1 && sortedModuleNumbers.length > 0) {

      const highestModuleNumber = sortedModuleNumbers[sortedModuleNumbers.length - 1];
      const lastBoss = bossFights?.find(f => f.module_number === highestModuleNumber);

      if (lastBoss?.status === 'defeated' && !activePlan.is_reward_claimed) {
        if (highestModuleNumber < activePlan.total_estimated_modules) {
          isWaitingForNextChapter = true;
        } else {
          isPlanComplete = true;
        }
      }
    }
  }


  return (
    <div className="h-full overflow-y-auto pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 px-4">
      <div className={`w-full max-w-2xl mx-auto flex flex-col items-center`}>
        {!activePlan ? (
          <div className="flex flex-col items-center gap-4">
            <p>No active quest found. Start a New Journey!</p>
            <Link href="/new-path">
              <Button>Begin a New Journey</Button>
            </Link>
          </div>
        ) : activePlan.is_reward_claimed ? (
          <div className="space-y-4 w-full max-w-2xl">
            <div className="p-8 bg-card text-center space-y-6">
              <div className="flex justify-center">
                <span className="text-6xl">🏆</span>
              </div>
              <h2 className="text-3xl font-bold text-yellow-500">Journey Complete!</h2>
              <p className="text-muted-foreground">
                You've completed this journey! Start a new one.
                <br />
                You've been awarded <span className="font-bold text-foreground">2000 Coins</span> and the <span className="font-bold text-foreground">Pathfinder Trophy</span>.
              </p>
              <div className="pt-4">
                <Link href="/new-path">
                  <Button size="lg" className="w-full">Begin a New Journey</Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 w-full max-w-2xl">
            <QuestRefreshListener planId={activePlan.id} />
            <StoryFetcher
              activePlan={activePlan}
              moduleNumber={activeModuleNumber !== -1 ? activeModuleNumber : (lastModuleNumber !== -1 ? lastModuleNumber : 1)}
            />
            {currentDayQuest ? (
              <div id="daily-quest-container" className="space-y-6">
                <div className="text-center space-y-2 px-4">
                  <h4 className="text-xl font-bold tracking-tight">
                    {currentDayQuest.title}
                  </h4>
                  {currentDayQuest.story && (
                    <p className="text-base text-muted-foreground italic leading-relaxed">
                      {currentDayQuest.story}
                    </p>
                  )}
                </div>

                <div className="px-2 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Chapter Completion</span>
                    <span>{completedTasksInModule} / {totalTasksInModule}</span>
                  </div>
                  <Progress value={totalTasksInModule > 0 ? (completedTasksInModule / totalTasksInModule) * 100 : 0} className="h-2" />
                </div>

                <div className="space-y-4">
                  {(() => {
                    const uncompletedInQuest = currentDayQuest.tasks.filter((t: Task) => !t.is_completed).length;
                    return currentDayQuest.tasks.sort((a: Task, b: Task) => a.id - b.id).map((task: Task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        plan_id={activePlan.id}
                        module_number={currentDayQuest.module_number}
                        day_number={currentDayQuest.day_number}
                        isLastTaskInQuest={uncompletedInQuest === 1 && !task.is_completed}
                        isLastTaskInModule={uncompletedTasksInModule === 1 && !task.is_completed}
                      />
                    ));
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-8 bg-card text-center min-h-[200px] flex flex-col items-center justify-center">
                {lastModuleNumber !== -1 ? (
                  <BossFightTrigger
                    planId={activePlan.id.toString()}
                    moduleNumber={lastModuleNumber}
                    initialCooldownUntil={initialCooldownUntil}
                    initialStoryPlot={initialStoryPlot}
                  />
                ) : isWaitingForNextChapter ? (
                  <InlineChapterLoader />
                ) : isPlanComplete ? (
                  <div className="flex flex-col items-center gap-4 p-6 text-center">
                    <h3 className="text-2xl font-bold text-yellow-500">YOU DID IT!</h3>
                    <p className="text-muted-foreground">You have conquered every single challenge along the way. <br />
                      We at Questr are proud of you! Well done!</p>

                  </div>
                ) : (
                  <p>No quests found for this plan!</p>
                )}
              </div>
            )}

            <NotesCard notes={notes} />

            <div className="p-6 bg-card transition-all flex flex-col gap-4">
              <h3 className="text-xl font-bold text-center">Changed your mind?</h3>
              <Link href="/new-path">
                <Button variant="outline" className="w-full">
                  Begin a New Journey
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
