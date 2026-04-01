"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Footprints, Map, Sword, Skull, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
    {
        step: "01",
        title: "Choose Your Path",
        desc: "Pick from our curated paths or enter your own goal. Questr builds a custom curriculum for you, tailored to your experience level.",
        icon: <Map className="h-6 w-6 2xl:h-10 2xl:w-10 text-primary-foreground" />,
        image: "/app-showcase/Path Selection-1.mp4",
        imagePlaceholder: "Select a Path"
    },
    {
        step: "02",
        title: "Complete Quests",
        desc: "Finish bite-sized daily tasks to progress through chapters. Get help when you need it and learn by doing, at your own pace.",
        icon: <Sword className="h-6 w-6 2xl:h-10 2xl:w-10 text-primary-foreground" />,
        image: "/app-showcase/quest-1.mp4",
        imagePlaceholder: "Daily Quests",
    },
    {
        step: "03",
        title: "Fight Bosses",
        desc: "Test your knowledge in epic boss battles at the end of each stage. Prove your mastery to advance.",
        icon: <Skull className="h-6 w-6 2xl:h-10 2xl:w-10 text-primary-foreground" />,
        image: "/app-showcase/boss fight-1.mp4",
        imagePlaceholder: "Boss Battle"
    },
    {
        step: "04",
        title: "Level Up",
        desc: "Earn XP, unlock new gear, care for your Companion and explore the Dungeons.",
        icon: <Trophy className="h-6 w-6 2xl:h-10 2xl:w-10 text-primary-foreground" />,
        image: "/app-showcase/dungeon-1.mp4",
        imagePlaceholder: "Companions"
    }
];

export function HowItWorks() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [stickyOffset, setStickyOffset] = useState(0);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start center", "end end"]
    });

    const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

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
            id="how-it-works"
            className="sticky z-10 min-h-screen flex flex-col justify-center relative"
            style={{
                top: stickyOffset,
                filter: "drop-shadow(0 -5px 15px rgba(0,0,0,0.15))"
            }}
        >
            <div
                className="w-full h-full bg-white dark:bg-background py-24 relative overflow-hidden shadow-[inset_0px_60px_120px_-20px_rgba(120,75,40,0.2)] dark:shadow-none"
                style={{
                    // Unique randomized jagged top edge (every 5%)
                    clipPath: "polygon(0% 15px, 5% 10px, 10% 21px, 15% 14px, 20% 8px, 25% 11px, 30% 19px, 35% 24px, 40% 16px, 45% 12px, 50% 20px, 55% 9px, 60% 14px, 65% 22px, 70% 15px, 75% 11px, 80% 18px, 85% 23px, 90% 17px, 95% 12px, 100% 14px, 100% 100%, 0% 100%)",
                }}
            >
                {/* Paper Texture Overlay */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply dark:hidden"
                    style={{ backgroundImage: `url('/assets/textures/paper_texture.jpg')`, backgroundSize: 'cover' }}
                />

                <div className="container mx-auto px-4 relative z-10">
                    <div className="text-center mb-16 lg:mb-12 2xl:mb-24">
                        <h2 className="text-3xl lg:text-3xl 2xl:text-7xl font-bold mb-4 lg:mb-4 2xl:mb-10 text-foreground" style={{ fontFamily: 'var(--font-uncial-antiqua)' }}>The Journey</h2>
                        <p className="text-xl lg:text-xl 2xl:text-4xl text-muted-foreground max-w-xl lg:max-w-xl 2xl:max-w-4xl mx-auto">Your path to mastery is clearer than ever.</p>
                    </div>

                    <div className="relative max-w-5xl 2xl:max-w-7xl mx-auto">
                        {/* Central Line (Desktop) */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] 2xl:w-[4px] bg-primary/10 -translate-x-1/2 hidden md:block rounded-full">
                            <motion.div
                                style={{ height: lineHeight }}
                                className="w-full bg-primary origin-top"
                            />
                        </div>

                        {/* Steps */}
                        <div className="relative z-10 space-y-20 md:space-y-16 2xl:space-y-48">
                            {STEPS.map((item, i) => (
                                <StepRow key={i} item={item} index={i} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function StepRow({ item, index }: { item: { step: string; title: string; desc: string; icon: React.ReactNode; imagePlaceholder: string; image?: string; imageClassName?: string }, index: number }) {

    const isEven = index % 2 === 0;
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
        <div ref={rowRef} className={`relative flex flex-col md:flex-row items-center gap-8 md:gap-16 2xl:gap-32 ${!isEven ? 'md:flex-row-reverse' : ''}`}>

            {/* Content Side */}
            <motion.div
                className="flex-1 text-center md:text-left space-y-3 lg:space-y-3 2xl:space-y-8 relative z-10"
                initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
            >
                <div className="inline-block p-1 bg-primary/10 rounded-2xl text-primary mb-2 md:mb-0">
                    <div className="bg-primary rounded-xl p-2.5 lg:p-2.5 2xl:p-5 w-fit shadow-md">
                        {item.icon}
                    </div>
                </div>

                <h3 className="text-2xl lg:text-2xl 2xl:text-6xl font-bold text-foreground">{item.title}</h3>
                <p className="text-lg lg:text-lg 2xl:text-3xl text-muted-foreground leading-relaxed font-medium">
                    {item.desc}
                </p>
            </motion.div>

            {/* Central Node Indicator (Static or Scale In) */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-10 h-10 lg:w-10 lg:h-10 2xl:w-20 2xl:h-20 rounded-full bg-background border-4 2xl:border-8 border-primary z-20 shadow-xl"
            >
                <span className="font-bold text-primary font-mono lg:text-sm 2xl:text-2xl">{item.step}</span>
            </motion.div>

            {/* Image Side */}
            <motion.div
                className="flex-1 w-full relative"
                initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
            >
                <div className="aspect-[4/3] bg-muted/30 rounded-3xl border-2 border-primary/20 shadow-lg flex items-center justify-center relative overflow-hidden">
                    {item.image ? (
                        <video
                            ref={videoRef}
                            src={item.image}
                            className={cn("w-full h-full object-cover", item.imageClassName)}
                            muted
                            loop
                            playsInline
                            key={item.image}
                        />
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-primary/5" />
                            <div className="text-center p-6">
                                <p className="font-bold text-primary/40 text-xl uppercase tracking-widest">{item.imagePlaceholder}</p>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

        </div>
    );
}
