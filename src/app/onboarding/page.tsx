"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CharacterViewer from "@/components/character/character-viewer";
import { ChevronLeft, ChevronRight, ArrowLeft, Gem, Map, Sword, Castle, Code, Cpu, Shield, Briefcase, Check, Loader2, Route, Sparkles } from "lucide-react";
import ForgingLoader from "@/components/ui/forging-loader";
import { useGoPro } from "@/hooks/use-go-pro";

const characterModels = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r"
].map(id => `/assets/3d-models/characters/character-${id}.glb`);

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

interface ProfileData {
    full_name: string | null;
    age: number | null;
    character_model_path: string | null;
    has_had_trial: boolean;
    onboarding_completed: boolean;
    date_of_birth?: string | null;
    gender?: string | null;
    onboarding_goal?: string | null;
    referral_source?: string | null;
}

interface SubscriptionData {
    status: string;
}

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        full_name: "",
        dob_day: "",
        dob_month: "",
        dob_year: "",
        gender: "",
        gender_custom: "",
        onboarding_goal: "",
        referral_source: "",
        goal_text: "",
        custom_experience: "",
    });

    const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isForging, setIsForging] = useState(false);
    const [hasHadTrial, setHasHadTrial] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isCustomPath, setIsCustomPath] = useState(false);


    const [referralCode, setReferralCode] = useState("");
    const [isCodeApplied, setIsCodeApplied] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validationError, setValidationError] = useState(false);
    const [isReferred, setIsReferred] = useState(false);

    const router = useRouter();
    const supabase = createClient();
    const { handleGoPro: handleGoProHook } = useGoPro();
    const generationTriggered = useRef(false);


    const [showProDialog, setShowProDialog] = useState(false);


    useEffect(() => {
        const savedCustomPath = localStorage.getItem("isCustomPath");
        if (savedCustomPath === "true") {
            setIsCustomPath(true);
        }
    }, []);


    const setCustomPathState = (value: boolean) => {
        setIsCustomPath(value);
        localStorage.setItem("isCustomPath", String(value));
    };



    const handleValidateReferral = async () => {
        if (!referralCode.trim()) {
            setStep(3);
            return;
        }

        setIsValidating(true);
        setValidationError(false);

        const { data: isValid, error } = await supabase.rpc('apply_referral_code', { code_input: referralCode.trim().toUpperCase() });

        setIsValidating(false);

        if (isValid) {
            setIsCodeApplied(true);
            setValidationError(false);
        } else {
            setValidationError(true);
            setIsCodeApplied(false);
        }
    };


    const triggerGeneration = async (goal: string) => {
        if (generationTriggered.current)
            generationTriggered.current = true;
        setIsLoading(true);
        setIsForging(false);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found.");

            let isSubscribed = false;

            if (isCustomPath) {
                const maxVerificationAttempts = 5;
                for (let i = 0; i < maxVerificationAttempts; i++) {
                    const { data: subscription } = await supabase
                        .from("subscriptions")
                        .select("status")
                        .eq("user_id", user.id)
                        .maybeSingle() as { data: SubscriptionData | null };

                    const validStatuses = ["active", "trialing", "pro"];
                    if (validStatuses.includes(subscription?.status || '')) {
                        isSubscribed = true;
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                if (!isSubscribed) {
                    setShowProDialog(true);
                    setIsForging(false);
                    setIsLoading(false);
                    setStep(6);
                    generationTriggered.current = false;
                    return;
                }
            }


            setIsLoading(false);
            setIsForging(true);

            const { error: planError } = await supabase.functions.invoke('plan-generator', {
                body: {
                    goal_text: goal,
                    abandon_previous: false,
                    experience: formData.custom_experience
                },
            });

            if (planError) {

                let errorMessage = planError.message;
                try {
                    if (planError.context && await planError.context.json) {
                        const body = await planError.context.json();
                        errorMessage = body.error || planError.message;
                    }
                } catch (e) { console.log('Error parsing error response', e) }

                throw new Error(errorMessage);
            }

            await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);

            localStorage.removeItem("onboarding_goal_text");

            localStorage.removeItem("isCustomPath");
            router.push("/dashboard");
            router.refresh();

        } catch (error: unknown) {
            const err = error as { message: string };


            if (err.message && err.message.includes("RPC Error")) {
                toast.error("Failed to load template.");
                setIsForging(false);
                setStep(6);
                generationTriggered.current = false;
                return;
            }


            if (err.message && (err.message.includes("Active subscription required") || err.message.includes("Payment Required"))) {
                console.error("Pro Feature Restriction hit:", err);
                setIsForging(false);
                setIsLoading(false);
                setStep(6);
                generationTriggered.current = false;
                setShowProDialog(true);
                return;
            }
            if (err.message && err.message.includes("Failed to send request")) {
                for (let i = 0; i < 30; i++) {
                    const { data: recentPlan } = await supabase
                        .from('plans')
                        .select('id')
                        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                        .limit(1)
                        .maybeSingle();

                    if (recentPlan) {
                        localStorage.removeItem("onboarding_goal_text");
                        router.push("/dashboard");
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            toast.error(err.message || "Failed to forge path.");
            setIsForging(false);
            setStep(6);
            generationTriggered.current = false;
        }
    };

    useEffect(() => {
        const init = async () => {

            const urlParams = new URLSearchParams(window.location.search);
            const isSuccess = urlParams.get('success') === 'true';
            const savedGoal = localStorage.getItem("onboarding_goal_text");

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single() as { data: ProfileData | null };

            if (profile?.onboarding_completed) {
                router.push("/dashboard");
                return;
            }


            if (isSuccess && !savedGoal) {
                toast.error("Session restored, but your goal was lost. Please select it again.");
                setStep(4);
                setIsLoading(false);
                return;
            }

            if (savedGoal) {
                await triggerGeneration(savedGoal);
                return;
            }

            if (profile) {
                let d = "", m = "", y = "";
                if (profile.date_of_birth) {
                    const date = new Date(profile.date_of_birth);
                    d = date.getDate().toString();
                    m = (date.getMonth() + 1).toString();
                    y = date.getFullYear().toString();
                }

                setFormData(prev => ({
                    ...prev,
                    full_name: profile.full_name || "",
                    dob_day: d,
                    dob_month: m,
                    dob_year: y,
                    gender: profile.gender || "",
                    onboarding_goal: profile.onboarding_goal || "",
                    referral_source: profile.referral_source || "",
                }));
                setHasHadTrial(profile.has_had_trial);
                if (profile.character_model_path) {
                    const charIndex = characterModels.indexOf(profile.character_model_path);
                    if (charIndex !== -1) setSelectedCharacterIndex(charIndex);
                }
            }

            setIsLoading(false);
        };
        init();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleNextStep = () => {

        if (step === 1) {
            if (!formData.full_name) return toast.error("Please enter your name.");


            if (!formData.dob_day || !formData.dob_month || !formData.dob_year) return toast.error("Please enter your date of birth.");
            const day = parseInt(formData.dob_day);
            const month = parseInt(formData.dob_month);
            const year = parseInt(formData.dob_year);
            const currentYear = new Date().getFullYear();

            if (isNaN(day) || isNaN(month) || isNaN(year)) return toast.error("Invalid date.");
            if (day < 1 || day > 31) return toast.error("Invalid day.");
            if (month < 1 || month > 12) return toast.error("Invalid month.");
            if (year < 1900 || year > currentYear - 13) return toast.error("Invalid year.");

            if (!formData.gender) return toast.error("Please select your gender.");
            if (formData.gender === "Other" && !formData.gender_custom) return toast.error("Please specify.");
        }


        if (step === 2) {
            if (!formData.onboarding_goal) return toast.error("Please select a goal.");
            if (!formData.referral_source) return toast.error("Please select a source.");

            if (formData.referral_source === "Friend/Referral") {
                setIsReferred(true);
                setStep(2.5);
                return;
            }
            setIsReferred(false);
        }

        if (step === 2.5) {
            if (isCodeApplied) {
                setStep(3);
                return;
            }
            if (referralCode.trim().length > 0) {
                handleValidateReferral();
                return;
            }

            setStep(3);
            return;
        }

        setStep((prev) => prev + 1);
    };

    const handlePrevStep = () => {
        if (step === 4 && selectedCategory) {
            setSelectedCategory(null);
            return;
        }
        if (step === 4) {
            setStep(3);
            return;
        }
        if (step === 3 && isReferred) {

            setStep(2.5);
            return;
        }
        if (step === 2.5) {
            setStep(2);
            return;
        }
        setStep((prev) => Math.max(1, prev - 1));
    };

    const handlePrevCharacter = () => {
        setSelectedCharacterIndex((prev) => (prev - 1 + characterModels.length) % characterModels.length);
    };

    const handleNextCharacter = () => {
        setSelectedCharacterIndex((prev) => (prev + 1) % characterModels.length);
    };

    const handleStartTrial = async () => {
        if (!formData.goal_text) {
            toast.error("Please select a path first.");
            setStep(4);
            return;
        }

        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const dob = `${formData.dob_year}-${formData.dob_month.padStart(2, '0')}-${formData.dob_day.padStart(2, '0')}`;
                const genderFinal = formData.gender === "Other" ? formData.gender_custom : formData.gender;

                await supabase.from("profiles").update({
                    full_name: formData.full_name,
                    date_of_birth: dob,
                    gender: genderFinal,
                    onboarding_goal: formData.onboarding_goal,
                    referral_source: formData.referral_source,
                    character_model_path: characterModels[selectedCharacterIndex],
                }).eq("id", user.id);
            }

            localStorage.setItem("onboarding_goal_text", formData.goal_text);
            const currentUrl = `${window.location.origin}/onboarding`;
            await handleGoProHook(currentUrl, currentUrl);
        } catch (e) {
            console.error("Failed to redirect", e);
            setIsLoading(false);
        }
    };

    const renderSelectionButton = (label: string, field: string, value: string) => (
        <Button
            variant="ghost"
            className={`justify-center h-10 text-sm px-3 transition-all ${formData[field as keyof typeof formData] === value
                ? 'border-4 border-primary text-primary font-bold bg-white/20'
                : 'border-2 border-primary/20 text-muted-foreground bg-white/20 hover:bg-white/40 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)] hover:-translate-y-0.5'
                }`}
            onClick={() => setFormData(prev => ({ ...prev, [field]: value }))}
        >
            {label}
        </Button>
    );

    const renderOptionCard = (label: string, field: string, value: string) => (
        <div
            className={`
            cursor-pointer rounded-lg p-3 text-center text-sm transition-all
            ${formData[field as keyof typeof formData] === value
                    ? 'border-4 border-primary text-primary font-bold bg-white/20'
                    : 'border-2 border-primary/20 text-muted-foreground hover:border-primary/50 bg-white/20 hover:bg-white/40 !shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:!shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)]'}
        `}
            onClick={() => setFormData(prev => ({ ...prev, [field]: value }))}
        >
            {label}
        </div>
    );


    const renderProDialog = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className={`bg-background w-full max-w-sm rounded-xl border-2 border-primary p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative`}>
                <div className="text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Gem className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-bold">Pro Feature</h3>
                        <p className="text-sm text-muted-foreground">
                            Custom paths are an exclusive Pro feature. You can subscribe to Pro to forge your own path, or choose from our curated roadmaps for free.
                        </p>
                    </div>
                    <div className="grid gap-2 pt-2">
                        <Button
                            className="bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white border-0 font-semibold w-full"
                            onClick={() => {
                                setShowProDialog(false);
                                handleStartTrial();
                            }}
                        >
                            Go Pro
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full border-primary/20 hover:bg-primary/5 hover:text-primary"
                            onClick={() => {
                                setShowProDialog(false);
                                setFormData(prev => ({ ...prev, goal_text: "", custom_experience: "" }));
                                setCustomPathState(false);
                                setStep(3);
                            }}
                        >
                            Change Path
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );


    const renderSectionTitle = (title: string, htmlFor?: string) => (
        <div className="w-fit mx-auto flex flex-col items-center gap-2 mb-3">
            <Label htmlFor={htmlFor} className="text-center font-medium">{title}</Label>
            <div className="w-[120%] h-px bg-primary/20" />
        </div>
    );

    return (
        <>
            {isForging && <ForgingLoader />}
            {isLoading && !isForging && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}
            {showProDialog && renderProDialog()}

            <div className={`h-screen w-full hover-card-glow flex flex-col items-center justify-center p-4 overflow-hidden relative ${(isLoading || isForging) ? 'hidden' : ''}`}>


                <div className="w-full max-w-md flex flex-col max-h-full">


                    <div className="text-center mb-6 shrink-0">
                        <h1 className="text-2xl font-bold tracking-tight">Welcome to Questr!</h1>
                        <p className="text-sm text-muted-foreground mt-1">Let&apos;s get you set up</p>
                        <div className="flex justify-center gap-1 mt-4">
                            {[1, 2, 3, 4, 5, 6].map((s) => (
                                <div key={s} className={`h-1 w-8 rounded-full transition-all ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
                            ))}
                        </div>
                    </div>


                    <div className="flex-1 min-h-0 px-1 py-2 overflow-hidden">


                        {step === 1 && (
                            <div className="space-y-5 text-center">
                                <div className="space-y-3">
                                    {renderSectionTitle("What should we call you?")}
                                    <Input
                                        name="full_name"
                                        value={formData.full_name}
                                        onChange={handleInputChange}
                                        placeholder="Your Name"
                                        className="text-center border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]"
                                    />
                                </div>

                                <div className="space-y-3">
                                    {renderSectionTitle("Date of Birth")}
                                    <div className="flex gap-2 justify-center">
                                        <Input name="dob_day" placeholder="DD" value={formData.dob_day} onChange={handleInputChange} className="w-[30%] text-center border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]" maxLength={2} />
                                        <Input name="dob_month" placeholder="MM" value={formData.dob_month} onChange={handleInputChange} className="w-[30%] text-center border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]" maxLength={2} />
                                        <Input name="dob_year" placeholder="YYYY" value={formData.dob_year} onChange={handleInputChange} className="w-[40%] text-center border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]" maxLength={4} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {renderSectionTitle("Gender")}
                                    <div className="grid grid-cols-2 gap-2">
                                        {["Male", "Female", "Non-binary", "Other"].map(g => renderSelectionButton(g, "gender", g))}
                                    </div>
                                    {formData.gender === "Other" && (
                                        <Input name="gender_custom" placeholder="..." value={formData.gender_custom} onChange={handleInputChange} className="mt-2 h-9 text-center border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]" />
                                    )}
                                </div>
                            </div>
                        )}


                        {step === 2 && (
                            <div className="space-y-6 text-center">
                                <div className="space-y-3">
                                    {renderSectionTitle("What brings you here?")}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            "Change Careers", "Learn a new Skill",
                                            "A new Hobby", "Other"
                                        ].map(opt => renderOptionCard(opt, "onboarding_goal", opt))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {renderSectionTitle("How did you find us?")}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            "Social Media", "Friend/Referral",
                                            "Search Engine", "Advertisement",
                                            "AI Recommendation", "Other"
                                        ].map(opt => renderOptionCard(opt, "referral_source", opt))}
                                    </div>
                                </div>
                            </div>
                        )}


                        {step === 2.5 && (
                            <div className="space-y-6 text-center">
                                {renderSectionTitle("Got a code?")}
                                <p className="text-xs text-muted-foreground mt-1"> Enter a referral code to get one month free Pro when you subscribe</p>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 relative">
                                        <Input
                                            placeholder="e.g. QBBIIK4W"
                                            className={`text-center uppercase border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] ${isCodeApplied ? '!border-green-500 ring-green-500/20' :
                                                validationError ? '!border-red-500 ring-red-500/20' : ''
                                                }`}
                                            value={referralCode}
                                            onChange={(e) => {
                                                setReferralCode(e.target.value);
                                                setValidationError(false);
                                            }}
                                            disabled={isCodeApplied || isValidating}
                                        />
                                        {isValidating && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                        {isCodeApplied && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <Check className="w-4 h-4 text-green-500" />
                                            </div>
                                        )}
                                    </div>
                                    {isCodeApplied && (
                                        <p className="text-xs text-green-600 dark:text-green-400">Validated.</p>
                                    )}
                                    {validationError && (
                                        <p className="text-xs text-red-500">Invalid code.</p>
                                    )}
                                </div>
                            </div>
                        )}


                        {step === 3 && (
                            <div className="grid gap-4 pt-2">
                                {renderSectionTitle("Which approach do you prefer?")}
                                <div
                                    className="cursor-pointer border-2 border-primary/20 text-muted-foreground bg-white/20 hover:bg-white/40 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)] hover:-translate-y-0.5 rounded-xl p-5 transition-all flex flex-row items-center gap-4 group"
                                    onClick={() => { setCustomPathState(false); setStep(4); }}
                                >
                                    <div className="p-3 rounded-full">
                                        <Map className="w-8 h-8" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-base">Curated Roadmaps</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Choose from a selection of high-growth career paths</p>
                                    </div>
                                </div>

                                <div
                                    className="relative cursor-pointer border-2 border-primary/20 text-muted-foreground bg-white/20 hover:bg-white/40 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)] hover:-translate-y-0.5 rounded-xl p-5 transition-all flex flex-row items-center gap-4 group"
                                    onClick={() => { setCustomPathState(true); setStep(4); }}
                                >
                                    <div className="absolute -top-3 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                        PRO FEATURE
                                    </div>
                                    <div className="p-3 rounded-full">
                                        <Gem className="w-8 h-8" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-base">Forge Your Own Path</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Custom goal with a personalized roadmap</p>
                                    </div>
                                </div>
                            </div>
                        )}


                        {step === 4 && !isCustomPath && (
                            <div className="space-y-4">
                                {!selectedCategory ? (
                                    <div className="grid gap-3">
                                        {PREMADE_JOURNEYS.map((cat) => (
                                            <div
                                                key={cat.category}
                                                className="cursor-pointer border-2 border-primary/20 text-muted-foreground bg-white/20 hover:bg-white/40 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)] hover:-translate-y-0.5 rounded-lg p-3 flex items-center gap-3 transition-all"
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
                                                className="cursor-pointer border-2 border-primary/20 text-muted-foreground bg-white/20 hover:bg-white/40 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)] hover:shadow-[0_8px_8px_-4px_rgba(90,60,40,0.12)] hover:-translate-y-0.5 rounded-lg p-3 transition-all text-left"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, goal_text: role.title }));
                                                    setStep(5);
                                                }}
                                            >
                                                <h3 className="font-semibold text-sm text-primary">{role.title}</h3>
                                                <p className="text-xs text-muted-foreground mt-1 leading-snug">{role.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}


                        {step === 4 && isCustomPath && (
                            <div className="space-y-4 h-full flex flex-col text-center">
                                <div className="space-y-4">
                                    {renderSectionTitle("What do you want to achieve?", "goal_text")}
                                    <div className="p-3 bg-primary border border-amber-500/20 rounded-md text-xs text-primary-foreground dark:text-amber-400">
                                        The more specific you are with your goal, the more tailored your learning path will be.
                                    </div>
                                    <Textarea
                                        id="goal_text"
                                        name="goal_text"
                                        value={formData.goal_text}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Learn 3D animation for video games"
                                        className="resize-none min-h-[100px] border-2 border-primary/20 focus-visible:ring-0 focus-visible:border-4 focus-visible:border-primary bg-white/20 shadow-[0_4px_4px_-2px_rgba(90,60,40,0.08)]"
                                    />
                                </div>

                                <div className="space-y-3 pt-2">
                                    {renderSectionTitle("Do you have experience in this?")}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            "None", "Very little",
                                            "I've done this before", "I'm proficient"
                                        ].map(opt => renderOptionCard(opt, "custom_experience", opt))}
                                    </div>
                                </div>
                            </div>
                        )}


                        {step === 5 && (
                            <div className="flex flex-col h-full gap-4">
                                <div className="text-center space-y-1">
                                    {renderSectionTitle("Choose your Avatar")}
                                </div>


                                <div className="flex-1 min-h-[250px] relative border rounded-lg bg-muted/20 overflow-hidden">
                                    <div className="absolute inset-0">
                                        <CharacterViewer
                                            key={selectedCharacterIndex}
                                            modelPath={characterModels[selectedCharacterIndex]}
                                        />
                                    </div>

                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none">
                                        <Button size="icon" variant="ghost" className="pointer-events-auto bg-background/50 hover:bg-background/80" onClick={handlePrevCharacter}><ChevronLeft /></Button>
                                        <Button size="icon" variant="ghost" className="pointer-events-auto bg-background/50 hover:bg-background/80" onClick={handleNextCharacter}><ChevronRight /></Button>
                                    </div>
                                </div>
                            </div>
                        )}


                        {step === 6 && (
                            <div className="space-y-4 h-full flex flex-col text-center">
                                <div className="shrink-0 space-y-2">
                                    <h2 className="text-2xl font-bold text-primary">Begin Your Journey</h2>
                                </div>

                                <div className="flex-1 min-h-0 flex gap-3 h-full pb-2">

                                    {/* Free Column */}
                                    <div className="flex-1 flex flex-col h-full rounded-xl overflow-hidden border-2 border-primary/20 bg-white/10 shadow-lg">
                                        <div className="p-4 bg-muted/30 text-center border-b border-primary/10">
                                            <h3 className="font-bold text-lg">Free</h3>
                                            <p className="text-xs text-muted-foreground">The Essentials</p>
                                        </div>
                                        <div className="p-4 flex-1 text-left space-y-2 overflow-y-auto custom-scrollbar">
                                            <ul className="text-xs space-y-2.5 text-muted-foreground">
                                                {[
                                                    "Free with Ads",
                                                    "Curated Roadmaps",
                                                    "Oracle Guidance",
                                                    "Curated Guilds",
                                                    "Access to The Citadel",
                                                    "Weekly Events",
                                                ].map((feat, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                                                        <span>{feat}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-muted/30 border-t border-primary/10 mt-auto">
                                            <Button
                                                onClick={() => triggerGeneration(formData.goal_text)}
                                                variant="secondary"
                                                className="w-full font-semibold border border-primary/20 hover:bg-primary/5"
                                            >
                                                Start Free
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Pro Column */}
                                    <div className="flex-1 flex flex-col h-full rounded-xl overflow-hidden border-2 border-primary bg-white/20 shadow-xl relative scale-[1.02] origin-bottom">
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                                        <div className="p-4 bg-primary/10 text-center border-b border-primary/20">
                                            <h3 className="font-bold text-lg text-primary">Pro</h3>
                                            <p className="text-xs text-primary/80 font-medium">Full Experience</p>
                                        </div>
                                        <div className="p-4 flex-1 text-left space-y-2 overflow-y-auto custom-scrollbar">
                                            <ul className="text-xs space-y-2.5 text-foreground/90 font-medium">
                                                {[
                                                    "Ad-Free",
                                                    "Custom Goals & Roadmaps",
                                                    "Higher Oracle limits",
                                                    "Premium Guilds Access",
                                                    "Access to Referral Program",
                                                    "Infinite Citadel rooms",
                                                    "Premium Weekly Events",
                                                    "Direct Access to the Developers",
                                                    "Early Access to New Features",
                                                    "and many more perks"
                                                ].map((feat, i) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                                                        <span>{feat}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-primary/10 border-t border-primary/20 mt-auto">
                                            <Button onClick={handleStartTrial} className="w-full bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white border-0 font-semibold shadow-lg">
                                                {hasHadTrial ? "Go Pro" : "Go Pro"}
                                            </Button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer Controls (Always Visible) */}
                    <div className="mt-6 pt-4 border-t shrink-0 z-10 w-full">
                        {step === 6 ? (
                            <div className="flex justify-center">
                                <Button variant="ghost" onClick={() => setStep(5)} className="text-muted-foreground text-xs py-1">
                                    <ArrowLeft className="w-3 h-3 mr-1" /> Back
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                {step > 1 && (
                                    <Button variant="ghost" onClick={handlePrevStep}>
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                                    </Button>
                                )}
                                <Button onClick={() => {
                                    if (step === 4 && isCustomPath) {
                                        if (!formData.goal_text) return toast.error("Please enter a goal");
                                        if (formData.goal_text.length > 1000) return toast.error("Too long!");
                                        if (!formData.custom_experience) return toast.error("Please select your experience level");
                                        setStep(5);
                                    } else {
                                        handleNextStep();
                                    }
                                }} className="flex-1 ml-auto" disabled={isValidating}>
                                    {step === 2.5
                                        ? (isCodeApplied ? "Next" : (referralCode.trim() ? "Validate" : "Skip"))
                                        : "Next"}
                                </Button>
                            </div>
                        )}
                    </div>

                </div>
            </div >
        </>
    );
}

