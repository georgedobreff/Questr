"use client";

import { useState, useEffect, useRef } from "react";
import { Gamepad2, Sparkles, ArrowRight, ShieldUser, ChessQueen } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { OracleEye } from "@/components/ui/operational/oracle-eye";

export function Features() {
    const containerRef = useRef<HTMLElement>(null);
    const [stickyOffset, setStickyOffset] = useState(0);

    useEffect(() => {
        const calculateOffset = () => {
            if (containerRef.current) {
                const viewportHeight = window.innerHeight;
                const elementHeight = containerRef.current.offsetHeight;

                if (elementHeight > viewportHeight) {
                    setStickyOffset(viewportHeight - elementHeight);
                } else {
                    setStickyOffset(0);
                }
            }
        };

        calculateOffset();
        window.addEventListener('resize', calculateOffset);
        return () => window.removeEventListener('resize', calculateOffset);
    }, []);

    return (
        <section
            ref={containerRef}
            id="features"
            className="sticky z-30 min-h-screen flex flex-col justify-center relative"
            style={{
                top: stickyOffset,
                filter: "drop-shadow(0 -5px 15px rgba(0,0,0,0.15))"
            }}
        >
            <div
                className="w-full h-full bg-white dark:bg-background py-24 2xl:pb-48 relative overflow-hidden shadow-[inset_0px_60px_120px_-20px_rgba(120,75,40,0.2)] dark:shadow-none"
                style={{
                    // Unique randomized jagged top edge (every 5%)
                    clipPath: "polygon(0% 13px, 5% 21px, 10% 15px, 15% 10px, 20% 18px, 25% 24px, 30% 16px, 35% 12px, 40% 20px, 45% 9px, 50% 14px, 55% 22px, 70% 15px, 75% 11px, 80% 18px, 85% 23px, 90% 17px, 95% 12px, 100% 14px, 100% 100%, 0% 100%)",
                }}
            >
                {/* Paper Texture Overlay */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply dark:hidden"
                    style={{ backgroundImage: `url('/assets/textures/paper_texture.jpg')`, backgroundSize: 'cover' }}
                />

                <div className="container mx-auto px-4">
                    <div className="text-center mb-12 lg:mb-10 2xl:mb-24">
                        <h2
                            className="text-3xl lg:text-3xl 2xl:text-7xl font-bold mb-4 lg:mb-4 2xl:mb-10 text-foreground"
                            style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                        >
                            The Network
                        </h2>
                        <p className="text-lg lg:text-lg 2xl:text-3xl text-muted-foreground max-w-xl lg:max-w-xl 2xl:max-w-3xl mx-auto">
                            Connect with others, get support when you need it, and compete in weekly events
                        </p>
                    </div>

                    <div className="space-y-24 2xl:space-y-32 max-w-7xl 2xl:max-w-[90rem] mx-auto">
                        {/* Feature 1: Oracle */}
                        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-10 2xl:gap-24">
                            <div className="flex-1 space-y-4 lg:space-y-4 2xl:space-y-8 text-center lg:text-left">
                                <div className="inline-block p-2 lg:p-2.5 2xl:p-4 bg-primary/10 rounded-2xl text-primary mb-2">
                                    <Sparkles className="h-6 w-6 lg:h-7 lg:w-7 2xl:h-10 2xl:w-10" />
                                </div>
                                <h3
                                    className="text-2xl lg:text-2xl 2xl:text-5xl font-bold text-foreground"
                                    style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                                >
                                    The Oracle
                                </h3>
                                <p className="text-lg lg:text-lg 2xl:text-3xl text-muted-foreground leading-relaxed">
                                    Stuck on a task and need some guidance? Chat or talk to The Oracle for personalized support 24/7.
                                </p>

                            </div>
                            <div className="flex-1 w-full relative">
                                <div className="aspect-video bg-background rounded-3xl border border-primary/20 shadow-xl flex items-center justify-center relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-primary/5" />
                                    <OracleEye
                                        size="80%"
                                        mode="idle"
                                        className="opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Feature 2: Guilds */}
                        <FeatureRow
                            title="Guilds"
                            desc="Connect with other Questrs through guilds, complete a guild quest together and support each other on your journey."
                            video="/app-showcase/guilds-1.mp4"
                            icon={<ShieldUser className="h-6 w-6 lg:h-7 lg:w-7 2xl:h-10 2xl:w-10" />}
                            reverse
                        />

                        {/* Feature 3: Dungeons */}
                        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-10 2xl:gap-24">
                            <div className="flex-1 space-y-4 lg:space-y-4 2xl:space-y-8 text-center lg:text-left">
                                <div className="inline-block p-2 lg:p-2.5 2xl:p-4 bg-primary/10 rounded-2xl text-primary mb-2">
                                    <ChessQueen className="h-6 w-6 lg:h-7 lg:w-7 2xl:h-10 2xl:w-10" />
                                </div>
                                <h3
                                    className="text-2xl lg:text-2xl 2xl:text-5xl font-bold text-foreground"
                                    style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                                >
                                    Weekly Events
                                </h3>
                                <p className="text-lg lg:text-lg 2xl:text-3xl text-muted-foreground leading-relaxed">
                                    Compete in weekly events to test your knowledge, earn rewards and climb the leaderboard.
                                </p>
                            </div>
                            <div className="flex-1 w-full relative">
                                <div className="aspect-video bg-background rounded-3xl border border-primary/20 shadow-xl flex items-center justify-center p-8 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-primary/5" />
                                    <div className="text-center relative z-10">
                                        <ChessQueen className="h-24 w-24 2xl:h-28 2xl:w-28 text-primary mx-auto mb-4" />
                                        <p className="font-bold text-muted-foreground 2xl:text-2xl">Coming Soon</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function FeatureRow({ title, desc, video, icon, reverse }: { title: string, desc: string, video: string, icon: React.ReactNode, reverse?: boolean }) {
    const rowRef = useRef(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const isInView = useInView(rowRef, { once: false, amount: 0.2 });

    useEffect(() => {
        if (videoRef.current) {
            if (isInView) {
                videoRef.current.play().catch(() => { });
            } else {
                videoRef.current.pause();
            }
        }
    }, [isInView]);

    return (
        <div ref={rowRef} className={cn("flex flex-col lg:flex-row items-center gap-10 lg:gap-10 2xl:gap-24", reverse && "lg:flex-row-reverse")}>
            <div className="flex-1 space-y-4 lg:space-y-4 2xl:space-y-8 text-center lg:text-left">
                <div className="inline-block p-2 lg:p-2.5 2xl:p-4 bg-primary/10 rounded-2xl text-primary mb-2">
                    {icon}
                </div>
                <h3
                    className="text-2xl lg:text-2xl 2xl:text-5xl font-bold text-foreground"
                    style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                >
                    {title}
                </h3>
                <p className="text-lg lg:text-lg 2xl:text-3xl text-muted-foreground leading-relaxed">
                    {desc}
                </p>
            </div>
            <div className="flex-1 w-full relative">
                <div className="aspect-video bg-background rounded-3xl border border-primary/20 shadow-xl flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5" />
                    <video
                        ref={videoRef}
                        src={video}
                        className="w-full h-full object-cover scale-[1.07]"
                        muted
                        loop
                        playsInline
                    />
                </div>
            </div>
        </div>
    );
}
