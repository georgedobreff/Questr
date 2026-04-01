"use client";

import { useEffect, useState } from "react";
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
import BossArena from "@/components/backgrounds/boss-arena";
import dynamic from "next/dynamic";
import { Loader2, ShieldAlert, Swords } from "lucide-react";
import { toast } from "sonner";

const DynamicMarkdown = dynamic(() => import('@/components/markdown-renderer'), { ssr: false });

interface Question {
    question: string;
    options: string[];
    correct_index: number;
}

interface BossFightDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    planId: string;
    moduleNumber: number;
    onVictory: () => void;
    onBossDefeated?: () => void;
    onRecovery: () => void;
    onFailure?: () => void;
}

interface BossFightData {
    id: string;
    boss_type: string;
    boss_model_path: string;
    story_plot: string;
    questions: string | Question[];
    player_hp: number;
    boss_hp: number;
    status: string;
    cooldown_until?: string;
    error?: string;
}

export default function BossFightDialog({
    isOpen,
    onOpenChange,
    planId,
    moduleNumber,
    onVictory,
    onBossDefeated,
    onRecovery,
    onFailure
}: BossFightDialogProps) {
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [fightData, setFightData] = useState<BossFightData | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isFetchingOracle, setIsFetchingOracle] = useState(false);
    const [userModelPath, setUserModelPath] = useState<string>("/assets/3d-models/characters/character-l.glb");

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<number[]>([]);
    const [oracleExplanation, setOracleExplanation] = useState<string | null>(null);

    const [playerHp, setPlayerHp] = useState(100);
    const [bossHp, setBossHp] = useState(100);
    const [playerAnim, setPlayerAnim] = useState('Idle');
    const [bossAnim, setBossAnim] = useState('Idle');
    const [gameState, setGameState] = useState<'intro' | 'fighting' | 'victory' | 'defeat' | 'cooldown' | 'recovery' | 'victory_review'>('intro');
    const [cooldownTime, setCooldownTime] = useState<Date | null>(null);
    const [isTurnProcessing, setIsTurnProcessing] = useState(false);

    const triggerOracleFetch = async (fightId: string) => {
        if (isFetchingOracle) return;
        if (oracleExplanation && oracleExplanation.length > 50) return;

        setIsFetchingOracle(true);
        setOracleExplanation("");

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-quiz-explanation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ boss_fight_id: fightId, user_answers: userAnswers, questions })
            });

            if (!response.ok) {
                const errJson = await response.json();
                throw new Error(errJson.error || "Failed to fetch explanation");
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";
            let displayedContent = "";
            let streamDone = false;

            const typingLoop = async () => {
                while (!streamDone || fullContent.length > displayedContent.length) {
                    if (fullContent.length > displayedContent.length) {
                        const nextChar = fullContent[displayedContent.length];
                        displayedContent += nextChar;
                        setOracleExplanation(displayedContent);

                        const backlog = fullContent.length - displayedContent.length;
                        const delay = backlog > 50 ? 5 : backlog > 10 ? 15 : 30;
                        await new Promise(r => setTimeout(r, delay));
                    } else {
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            };

            const typingPromise = typingLoop();

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    streamDone = true;
                    break;
                }
                if (value) {
                    fullContent += decoder.decode(value, { stream: true });
                }
            }

            await typingPromise;

        } catch (err) {
            console.error(err);
            setOracleExplanation("The Oracle is silent. Reflect on your mistakes.");
        } finally {
            setIsFetchingOracle(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const initFight = async () => {
            setLoading(true);
            try {

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('character_model_path').eq('id', user.id).single();
                    if (profile?.character_model_path) {
                        setUserModelPath(profile.character_model_path);
                    }
                }

                const { data, error } = await supabase.functions.invoke('generate-boss-quiz', {
                    body: { plan_id: planId, module_number: moduleNumber }
                });

                if (error) throw error;

                if (data.error === 'Cooldown active') {
                    setGameState('cooldown');
                    setCooldownTime(new Date(data.cooldown_until));
                    setFightData(data);
                    setLoading(false);
                    return;
                }

                setFightData(data);
                const parsedQuestions: Question[] = (typeof data.questions === 'string'
                    ? JSON.parse(data.questions)
                    : data.questions) as Question[];
                setQuestions(parsedQuestions);
                setPlayerHp(data.player_hp);
                setBossHp(data.boss_hp);
                setPlayerAnim('Idle');
                setBossAnim('Idle');
                setUserAnswers(new Array(parsedQuestions.length).fill(-1));

                if (data.status === 'defeated') {
                    setGameState('victory');
                } else {
                    setGameState('intro');
                }

            } catch (err) {
                console.error(err);
                toast.error("Failed to prepare boss fight. The Oracle is silent.");
                onOpenChange(false);
            } finally {
                setLoading(false);
            }
        };

        initFight();
    }, [isOpen, planId, moduleNumber]);

    useEffect(() => {
        if ((gameState === 'recovery' || gameState === 'victory_review') && !oracleExplanation && !isFetchingOracle && fightData?.id) {
            triggerOracleFetch(fightData.id);
        }
    }, [gameState, fightData, oracleExplanation, isFetchingOracle]);

    const handleAnswer = async (optionIndex: number) => {
        if (gameState !== 'fighting' || isTurnProcessing) return;

        setIsTurnProcessing(true);

        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = optionIndex;
        setUserAnswers(newAnswers);

        const currentQ = questions[currentQuestionIndex];
        const isCorrect = optionIndex === currentQ.correct_index;

        if (isCorrect) {
            setPlayerAnim('Attack');
            setBossAnim('Hit');
            setBossHp(prev => Math.max(0, prev - 10));
        } else {
            setBossAnim('Attack');
            setPlayerAnim('Hit');
            setPlayerHp(prev => Math.max(0, prev - 10));
        }

        setTimeout(() => {
            setPlayerAnim('Idle');
            setBossAnim('Idle');

            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex >= questions.length) {
                finishFight(playerHp - (isCorrect ? 0 : 10), bossHp - (isCorrect ? 10 : 0));
            } else {
                setCurrentQuestionIndex(nextIndex);
                setIsTurnProcessing(false);
            }
        }, 1500);
    };

    const finishFight = async (finalPlayerHp: number, finalBossHp: number) => {
        const won = finalPlayerHp > finalBossHp;

        const hasIncorrect = questions.some((q, i) => userAnswers[i] !== q.correct_index);

        if (won) {
            setBossAnim('Death');
            if (fightData) {
                await supabase.rpc('resolve_boss_fight', {
                    p_fight_id: fightData.id,
                    p_status: 'defeated',
                    p_player_hp: finalPlayerHp,
                    p_boss_hp: finalBossHp
                });
                if (onBossDefeated) onBossDefeated();
            }

            if (hasIncorrect) {
                setGameState('victory_review');
            } else {
                setGameState('victory');
            }
        } else {
            setPlayerAnim('Death');
            setGameState('defeat');
            if (fightData) {
                await supabase.rpc('resolve_boss_fight', {
                    p_fight_id: fightData.id,
                    p_status: 'failed',
                    p_player_hp: finalPlayerHp,
                    p_boss_hp: finalBossHp
                });

                if (onFailure) onFailure();

                triggerOracleFetch(fightData.id);

                supabase.functions.invoke('generate-boss-quiz', {
                    body: { plan_id: planId, module_number: moduleNumber, regenerate: true }
                });
            }
        }
        setIsTurnProcessing(false);
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-4xl h-[90vh] flex flex-col overflow-hidden p-4 sm:p-6 dialog-card-solid">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center justify-center gap-2 text-center">
                        <Swords className="h-5 w-5 text-red-500" />
                        Boss Encounter: {fightData?.boss_type || "Unknown Entity"}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Summoning the arena...</p>
                    </div>
                ) : gameState === 'cooldown' ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                        <ShieldAlert className="h-12 w-12 text-yellow-500" />
                        <h3 className="text-xl font-bold">You were defeated.</h3>
                        <p>You must recover your strength. The Oracle is protecting you.</p>
                        <p className="text-sm text-muted-foreground">Try again in {cooldownTime ? Math.ceil((cooldownTime.getTime() - Date.now()) / 60000) : 5} minutes.</p>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Retreat</Button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
                        {(gameState !== 'recovery' && gameState !== 'victory_review') && (
                            <BossArena
                                playerModelPath={userModelPath}
                                bossModelPath={fightData?.boss_model_path || "/assets/3d-models/enemies/Skeleton.gltf"}
                                playerHp={playerHp}
                                bossHp={bossHp}
                                playerAnimation={playerAnim}
                                bossAnimation={bossAnim}
                                className="flex-shrink-0 h-[25vh] min-h-[200px] sm:h-[30vh]"
                            />
                        )}

                        <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto">
                            {gameState === 'intro' && (
                                <div className="text-center space-y-4">
                                    <p className="text-muted-foreground font-medium">Prove your mastery to proceed.</p>
                                    <Button size="lg" className="w-full" onClick={() => setGameState('fighting')}>
                                        Begin Combat
                                    </Button>
                                </div>
                            )}

                            {gameState === 'fighting' && questions[currentQuestionIndex] && (
                                <div className="flex flex-col gap-4 h-full animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex-shrink-0 h-auto min-h-[80px] max-h-32 flex items-center justify-center p-4 bg-muted/30 rounded-lg border border-border/50">
                                        <h3 className="text-sm sm:text-base md:text-lg font-bold text-center overflow-y-auto max-h-full">
                                            {questions[currentQuestionIndex].question}
                                        </h3>
                                    </div>
                                    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 items-stretch content-stretch">
                                        {questions[currentQuestionIndex].options.map((opt, i) => (
                                            <Button
                                                key={i}
                                                variant="outline"
                                                className="h-full py-2 px-3 sm:py-4 sm:px-4 text-left justify-start whitespace-normal"
                                                disabled={isTurnProcessing}
                                                onClick={() => handleAnswer(i)}
                                            >
                                                <div className="flex items-start w-full">
                                                    <span className="mr-2 font-bold text-muted-foreground flex-shrink-0">{["A", "B", "C", "D"][i]}.</span>
                                                    <span className="text-xs sm:text-sm md:text-base line-clamp-3">{opt}</span>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="text-center text-xs text-muted-foreground flex-shrink-0">
                                        Question {currentQuestionIndex + 1} of {questions.length}
                                    </div>
                                </div>
                            )}

                            {gameState === 'victory' && (
                                <div className="text-center space-y-4 bg-green-500/10 p-6 rounded-xl border border-green-500/20">
                                    <h3 className="text-2xl font-bold text-green-500">Victory!</h3>
                                    <p>You have bested the {fightData?.boss_type} and proven your knowledge.</p>
                                    <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={onVictory}>
                                        Continue Journey
                                    </Button>
                                </div>
                            )}

                            {gameState === 'victory_review' && (
                                <div className="flex-1 flex flex-col min-h-0 gap-4">
                                    <div className="flex-shrink-0 text-center space-y-2 bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                                        <h3 className="text-xl font-bold text-green-500">Victory, but...</h3>
                                        <p className="text-sm">You defeated the boss, but the Oracle has advice for your mistakes.</p>
                                    </div>

                                    <div className="flex-1 min-h-0 p-4 bg-muted rounded-lg overflow-y-auto">
                                        {isFetchingOracle && !oracleExplanation ? (
                                            <div className="flex items-center gap-2 h-full justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                <span className="text-sm italic text-muted-foreground">The Oracle is reviewing your battle...</span>
                                            </div>
                                        ) : (
                                            <div className="text-sm">
                                                <DynamicMarkdown>{oracleExplanation || ""}</DynamicMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <Button size="lg" className="flex-shrink-0 w-full bg-green-600 hover:bg-green-700" onClick={onVictory}>
                                        I Understand - Continue Journey
                                    </Button>
                                </div>
                            )}

                            {gameState === 'defeat' && (
                                <div className="text-center space-y-4 bg-red-500/10 p-6 rounded-xl border border-red-500/20">
                                    <h3 className="text-2xl font-bold text-red-500">Defeat...</h3>
                                    <p>The {fightData?.boss_type} was too powerful. You need to review your training.</p>
                                    <Button size="lg" variant="destructive" className="w-full" onClick={() => {
                                        setGameState('recovery');
                                        setPlayerAnim('Idle');
                                        setBossAnim('Idle');
                                    }}>
                                        Enter Recovery
                                    </Button>
                                </div>
                            )}

                            {gameState === 'recovery' && (
                                <div className="flex-1 flex flex-col min-h-0 gap-4">
                                    <h3 className="flex-shrink-0 text-xl font-bold">The Oracle's Wisdom</h3>
                                    <div className="flex-1 min-h-0 p-4 bg-muted rounded-lg overflow-y-auto">
                                        {isFetchingOracle && !oracleExplanation ? (
                                            <div className="flex items-center gap-2 h-full justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                <span className="text-sm italic text-muted-foreground">Communing with the spirits...</span>
                                            </div>
                                        ) : (
                                            <div className="text-sm">
                                                <DynamicMarkdown>{oracleExplanation || ""}</DynamicMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="outline" className="flex-shrink-0 w-full" onClick={onRecovery}>
                                        Rest & Try Later
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
