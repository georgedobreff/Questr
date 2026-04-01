"use client";

import { motion } from "framer-motion";
import { Scroll } from "lucide-react";

export function About() {
    return (
        <section
            id="about"
            className="sticky top-0 z-10 flex flex-col justify-center bg-[#fdfaf3] dark:bg-background border-t border-primary/10 dark:border-t-border shadow-[0_-20px_50px_rgba(0,0,0,0.1)]"
            style={{ top: 0 }}
        >
            <div className="w-full relative pt-24 pb-20 min-h-screen flex flex-col justify-center">

                <div className="container mx-auto px-4 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="max-w-3xl lg:max-w-3xl 2xl:max-w-5xl mx-auto space-y-6 lg:space-y-6 2xl:space-y-12"
                    >

                        <h2 className="text-3xl lg:text-3xl 2xl:text-7xl font-bold text-foreground" style={{ fontFamily: 'var(--font-uncial-antiqua)' }}>
                            What is Questr?
                        </h2>

                        <p className="text-xl lg:text-xl 2xl:text-4xl leading-relaxed text-muted-foreground">
                            Questr uses advanced machine learning to transform your ambitious goals into bite-sized daily quests.
                            Your studies fuel an immersive RPG journey through The Citadel, where progression depends on your knowledge.
                        </p>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
