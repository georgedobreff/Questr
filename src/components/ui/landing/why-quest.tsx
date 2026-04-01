"use client";

import { motion } from "framer-motion";
import { Brain, Trophy, Sword } from "lucide-react";
import { useRef, useState, useEffect } from "react";

export function WhyQuest() {
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
            id="why-questr"
            className="sticky z-20 min-h-screen flex flex-col justify-center bg-[#fdfaf3] dark:bg-background border-t border-primary/10 dark:border-t-border shadow-[0_-20px_50px_rgba(0,0,0,0.15)]"
            style={{ top: stickyOffset }}
        >
            <div className="w-full pointer-events-auto pt-12 pb-32 min-h-screen flex flex-col justify-center relative transition-all">

                <div className="container mx-auto px-4 text-center relative z-10 pt-12">
                    <h2
                        className="text-3xl lg:text-3xl 2xl:text-7xl font-bold mb-12 lg:mb-12 2xl:mb-24 text-foreground"
                        style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                    >
                        Backed by Science
                    </h2>
                    <p className="text-xl lg:text-xl 2xl:text-4xl text-muted-foreground max-w-xl lg:max-w-xl 2xl:max-w-4xl mx-auto">We combined the most effective learning techniques focused on enhancing neural plasticity and memory consolidation through active engagement</p>
                    <br />
                    <br />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 2xl:gap-12">
                        {[
                            {
                                title: "Spaced Repetition",
                                description: "Breaking down complex topics into manageable daily quests ensures you never feel overwhelmed allowing for better memory consolidation.",
                                icon: <Brain className="h-8 w-8 2xl:h-12 2xl:w-12 text-primary" />
                            },
                            {
                                title: "Emotional Engagement",
                                description: "Incorporating elements of storytelling, companionship, and adventure creates stronger connections to the material, significantly boosting retention.",
                                icon: <Trophy className="h-8 w-8 2xl:h-12 2xl:w-12 text-primary" />
                            },
                            {
                                title: "Active Recall",
                                description: "Boss battles force your brain to retrieve information under pressure, strengthening neural pathways and improving long-term retention.",
                                icon: <Sword className="h-8 w-8 2xl:h-12 2xl:w-12 text-primary" />
                            }
                        ].map((item, i) => (
                            <div key={i} className="bg-background border border-primary/20 rounded-2xl p-6 lg:p-6 2xl:p-12 shadow-sm hover:shadow-lg transition-all text-center">
                                <div className="mb-4 lg:mb-4 p-3 lg:p-3 rounded-2xl bg-primary/10 w-fit mx-auto text-primary">
                                    {item.icon}
                                </div>
                                <h3 className="text-xl lg:text-xl 2xl:text-4xl font-bold mb-2 lg:mb-2 text-foreground">{item.title}</h3>
                                <p className="text-lg lg:text-lg 2xl:text-2xl text-muted-foreground leading-relaxed font-medium">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
