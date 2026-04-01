"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import ForgingLoader from "@/components/ui/forging-loader";
import {
  Lock,
  Map,
  Gem,
  ChevronRight,
  Code,
  Cpu,
  Shield,
  Briefcase,
  ArrowLeft
} from "lucide-react";
import { useGoPro } from "@/hooks/use-go-pro";
import PlanCreditCheck from "@/components/ui/operational/plan-credit-check";

const PREMADE_JOURNEYS = [
  {
    category: "Software Development",
    icon: <Code className="w-6 h-6" />,
    roles: [
      { title: "Full-Stack Web Developer", description: "React, Next.js, & TypeScript focus" },
      { title: "Backend Systems Engineer", description: "Python, Go, or Java architecture" },
      { title: "Mobile App Developer", description: "Cross-platform iOS & Android" },
      { title: "Cloud Infrastructure Engineer", description: "AWS/Azure & DevOps" },
    ]
  },
  {
    category: "AI & Data Science",
    icon: <Cpu className="w-6 h-6" />,
    roles: [
      { title: "AI Integrations Engineer", description: "LLMs, RAG, & Agentic Workflows" },
      { title: "Data Scientist", description: "Statistical Modeling & Machine Learning" },
      { title: "Business Intelligence Analyst", description: "Data Visualization & SQL" },
      { title: "Machine Learning Ops (MLOps)", description: "Scaling & Deploying AI" },
    ]
  },
  {
    category: "Cybersecurity",
    icon: <Shield className="w-6 h-6" />,
    roles: [
      { title: "Ethical Hacker", description: "Offensive Security & Pen-Testing" },
      { title: "Security Operations Analyst", description: "Defensive Monitoring (SOC)" },
      { title: "Cloud Security Architect", description: "Securing Enterprise Infrastructure" },
      { title: "Incident Response Specialist", description: "Threat Hunting & Recovery" },
    ]
  },
  {
    category: "Business & Strategy",
    icon: <Briefcase className="w-6 h-6" />,
    roles: [
      { title: "Growth Marketing Manager", description: "SEO, SEM, & Funnel Optimization" },
      { title: "Digital Product Manager", description: "Lifecycle & Strategy" },
      { title: "Technical SaaS Founder", description: "Product-Led Growth & Launch" },
      { title: "Operations Strategy Consultant", description: "Process Automation & Scaling" },
    ]
  }
];

const formSchema = z.object({
  goal_text: z.string().min(10, {
    message: "Objective must be at least 10 characters.",
  }).max(1000, {
    message: "Objective cannot be longer than 1000 characters.",
  }),
  experience: z.string().min(1, {
    message: "Please select your experience level.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewPathPage() {
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false);
  const [isModerationOpen, setIsModerationOpen] = useState(false);
  const [isProDialogOpen, setIsProDialogOpen] = useState(false);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [hasHadTrial, setHasHadTrial] = useState(false);
  const [formValues, setFormValues] = useState<FormValues | null>(null);


  const [creditCheckOpen, setCreditCheckOpen] = useState(false);
  const [planGenerationsCount, setPlanGenerationsCount] = useState(0);
  const [purchasedPlanCredits, setPurchasedPlanCredits] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState("free");


  const [step, setStep] = useState(1);
  const [isCustomPath, setIsCustomPath] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const { handleGoPro } = useGoPro();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal_text: "",
      experience: "",
    },
  });

  useEffect(() => {
    const validStatuses = ["active", "trialing", "pro"];

    const fetchUserAndPlanData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }


      const { data: rpcData, error: rpcError } = await supabase.rpc('check_and_reset_plan_limit');

      if (rpcError) {
        console.error("Error fetching plan data:", rpcError);

        const [subscriptionRes, profileRes] = await Promise.all([
          supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles").select("has_had_trial, plan_generations_count, purchased_plan_credits").eq("id", user.id).single()
        ]);

        const status = subscriptionRes.data?.status || 'free';
        setSubscriptionStatus(status);
        setIsPro(validStatuses.includes(status));

        if (profileRes.data) {
          setHasHadTrial(profileRes.data.has_had_trial || false);
          setPlanGenerationsCount(profileRes.data.plan_generations_count || 0);
          setPurchasedPlanCredits(profileRes.data.purchased_plan_credits || 0);
        }
      } else if (rpcData) {

        const status = rpcData.subscription_status || 'free';
        setSubscriptionStatus(status);
        setIsPro(validStatuses.includes(status));
        setHasHadTrial(rpcData.has_had_trial || false);
        setPlanGenerationsCount(rpcData.plan_generations_count || 0);
        setPurchasedPlanCredits(rpcData.purchased_plan_credits || 0);
      }
    };

    fetchUserAndPlanData();
  }, [supabase, router]);

  const createPath = async (values: FormValues, abandon_previous: boolean = false) => {
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('plan-generator', {
        body: {
          goal_text: values.goal_text,
          abandon_previous: abandon_previous,
          experience: values.experience
        },
      });

      if (error) throw error;

      toast.success("New Path Forged!");
      form.reset();
      router.push("/log");
    } catch (err: unknown) {
      const error = err as { context?: { status: number; error: string }, message: string };

      if (error.message && error.message.includes("Failed to send request")) {
        let attempts = 0;
        const maxAttempts = 30;

        try {
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const { data: recentPlan } = await supabase
              .from('plans')
              .select('created_at')
              .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (recentPlan) {
              const createdTime = new Date(recentPlan.created_at).getTime();
              const now = new Date().getTime();

              if (now - createdTime < 120000) {
                toast.success("New Path Forged!");
                form.reset();
                router.push("/log");
                return;
              }
            }
            attempts++;
          }
          throw new Error("The spirits are taking too long to forge your path. Please try again.");
        } catch (pollErr: unknown) {
          if (pollErr instanceof Error) {
            error.message = pollErr.message;
          }
        }
      }

      if (error.context?.status === 400) {
        setIsModerationOpen(true);
      }
      else if (error.context?.status === 429) {
        setIsRateLimitOpen(true);
      } else {
        const errorMessage = error.context?.error || error.message || "An unknown error occurred.";
        const isTech = errorMessage.includes("Functions") || errorMessage.includes("Edge Function") || errorMessage.includes("fetch");
        toast.error(isTech ? "Something went wrong. Try again." : errorMessage);
        console.error("Error forging new path:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndCreate = async () => {
    setIsConfirmOpen(false);
    if (formValues) {
      await createPath(formValues, true);
    }
  };

  async function onSubmit(values: FormValues) {
    try {
      const { data: existingPlan, error: checkError } = await supabase
        .from('plans')
        .select('id')
        .limit(1)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Failed to check for existing quests: ${checkError.message}`);
      }

      if (existingPlan) {
        setFormValues(values);
        setIsConfirmOpen(true);
      } else {
        await createPath(values, false);
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
      console.error(err);
    }
  }

  const handleBack = () => {
    if (step === 2 && !isCustomPath && selectedCategory) {
      setSelectedCategory(null);
      return;
    }
    if (step === 2) {
      setStep(1);
      setIsCustomPath(false);
      return;
    }
  };

  if (isPro === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <>
      {loading && <ForgingLoader />}
      <div className="h-full w-full overflow-y-auto">
        <main className="min-h-full flex flex-col items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-lg space-y-8 relative">
            <div className="text-center space-y-2 relative pt-10 md:pt-0">
              {step > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-0 md:-left-16 md:top-1"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              )}
              <h1 className="text-4xl font-bold">Start a New Journey</h1>
            </div>

            {/* Step 1: Choice */}
            {step === 1 && (
              <div className="grid gap-4 pt-2">
                <div
                  className="cursor-pointer rounded-xl p-5 transition-all titled-cards flex flex-row items-center gap-4 group"
                  onClick={() => { setIsCustomPath(false); setStep(2); }}
                >
                  <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                    <Map className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-base">Curated Roadmaps</h3>
                    <p className="text-xs text-muted-foreground mt-1">Choose from a selection of high-growth career paths</p>
                  </div>
                </div>

                <div
                  className={isPro
                    ? "cursor-pointer rounded-xl p-5 transition-all titled-cards flex flex-row items-center gap-4 group"
                    : "relative cursor-pointer border-2 border-primary/20 text-muted-foreground bg-white/20 hover:bg-white/40 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)] hover:-translate-y-0.5 rounded-xl p-5 transition-all flex flex-row items-center gap-4 group"
                  }
                  onClick={() => {
                    if (isPro) {
                      setCreditCheckOpen(true);

                    } else {
                      setIsProDialogOpen(true);
                    }
                  }}
                >
                  {!isPro && (
                    <div className="absolute -top-3 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      PRO FEATURE
                    </div>
                  )}
                  <div className="p-3 bg-purple-500/10 rounded-full group-hover:bg-purple-500/20 transition-colors">
                    <Gem className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-base">Forge Your Own Path</h3>
                    <p className="text-xs text-muted-foreground mt-1">Custom goal with a personalized roadmap</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2A: Premade Selection */}
            {step === 2 && !isCustomPath && (
              <div className="space-y-4">
                {!selectedCategory ? (
                  <div className="grid gap-3">
                    {PREMADE_JOURNEYS.map((cat) => (
                      <div
                        key={cat.category}
                        className="cursor-pointer titled-cards rounded-lg p-3 flex items-center gap-3 transition-all"
                        onClick={() => setSelectedCategory(cat.category)}
                      >
                        <div className="p-2 bg-muted rounded-full text-primary shrink-0">
                          {cat.icon}
                        </div>
                        <div className="text-left overflow-hidden">
                          <h3 className="font-semibold text-sm truncate">{cat.category}</h3>
                        </div>
                        <ChevronRight className="ml-auto w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {PREMADE_JOURNEYS.find(c => c.category === selectedCategory)?.roles.map((role) => (
                      <div
                        key={role.title}
                        className="cursor-pointer titled-cards rounded-lg p-3 transition-all text-left"
                        onClick={() => onSubmit({ goal_text: role.title, experience: "Beginner" })}
                      >
                        <h3 className="font-semibold text-sm text-primary">{role.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">{role.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2B: Custom Input */}
            {step === 2 && isCustomPath && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="goal_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="What do you want to achieve?"
                            className="resize-none h-24 border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]"
                            {...field}
                            disabled={loading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {[
                            "None", "Very little",
                            "I've done this before", "I'm proficient"
                          ].map(opt => (
                            <div
                              key={opt}
                              className={`
                                cursor-pointer rounded-lg p-3 text-center text-sm transition-all
                                ${field.value === opt
                                  ? 'border-4 border-primary text-primary font-bold bg-white/20'
                                  : 'border-2 border-primary/20 text-muted-foreground hover:border-primary/50 bg-white/20 hover:bg-white/40 !shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:!shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)]'}
                              `}
                              onClick={() => field.onChange(opt)}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Forging..." : "Start Journey"}
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </main>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="dialog-card-glass">
          <DialogHeader>
            <DialogTitle>Abandon Current Journey?</DialogTitle>
            <DialogDescription>
              Starting a new one will abandon it and all progress will be lost. This action is irreversible. Do you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAndCreate}>Proceed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRateLimitOpen} onOpenChange={setIsRateLimitOpen}>
        <DialogContent className="dialog-card-glass">
          <DialogHeader>
            <DialogTitle>Slow Down</DialogTitle>
            <DialogDescription>
              You're going too fast. Try again in a few minutes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsRateLimitOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModerationOpen} onOpenChange={setIsModerationOpen}>
        <DialogContent className="dialog-card-glass">
          <DialogHeader>
            <DialogTitle>Inappropriate Content</DialogTitle>
            <DialogDescription>
              This has been flagged as inappropriate or unsafe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsModerationOpen(false)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isProDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-sm rounded-xl border-2 border-primary p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Gem className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold">Pro Feature</h3>
                <p className="text-sm text-muted-foreground">
                  Custom paths are an exclusive Pro feature. You can Upgrade to forge your own path, or choose from our curated roadmaps for free.
                </p>
              </div>
              <div className="grid gap-2 pt-2">
                <Button
                  className="bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white border-0 font-semibold w-full"
                  onClick={() => {
                    setIsProDialogOpen(false);
                    handleGoPro();
                  }}
                >
                  Upgrade
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-primary/20 hover:bg-primary/5 hover:text-primary"
                  onClick={() => {
                    setIsProDialogOpen(false);
                  }}
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PlanCreditCheck
        open={creditCheckOpen}
        onOpenChange={setCreditCheckOpen}
        onConfirm={() => {
          setIsCustomPath(true);
          setStep(2);
          setCreditCheckOpen(false);
        }}
        planGenerationsCount={planGenerationsCount}
        subscriptionStatus={subscriptionStatus}
        purchasedPlanCredits={purchasedPlanCredits}
      />
    </>
  );
}