"use client";

import { useState, useEffect } from "react";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";


export function Pricing() {
    const [currency, setCurrency] = useState("$");
    const [price, setPrice] = useState("8.99");

    useEffect(() => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (["Europe/London", "Europe/Dublin", "Europe/Belfast", "Europe/Jersey", "Europe/Guernsey", "Europe/Isle_of_Man"].includes(timeZone)) {
            setCurrency("£");
            setPrice("6.99");
        } else if (timeZone.startsWith("Europe/")) {
            setCurrency("€");
            setPrice("6.99");
        }
    }, []);

    return (
        <section
            id="pricing"
            className="sticky top-0 z-40 min-h-screen flex flex-col justify-center bg-[#fdfaf3] dark:bg-background border-t border-primary/10 dark:border-t-border shadow-[0_-20px_50px_rgba(0,0,0,0.2)]"
        >
            <div className="w-full pointer-events-auto pt-12 pb-20 min-h-screen flex flex-col justify-center relative">

                <div className="container mx-auto px-4 text-center relative z-10 pt-12">
                    <h2
                        className="text-3xl lg:text-3xl 2xl:text-7xl font-bold mb-4 lg:mb-4 2xl:mb-10 text-foreground"
                        style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                    >
                        Pricing
                    </h2>
                    <p className="text-lg lg:text-lg max-w-xl lg:max-w-xl 2xl:max-w-3xl 2xl:text-3xl mx-auto mb-12 lg:mb-10 2xl:mb-24 text-muted-foreground">
                        Start Free or dive right into the full experience with Pro.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 2xl:gap-12 max-w-4xl 2xl:max-w-6xl mx-auto mb-12 lg:mb-16">
                        {/* Free Tier */}
                        <div className="bg-background border border-primary/20 rounded-3xl p-6 lg:p-8 md:p-12 2xl:p-14 shadow-sm hover:shadow-xl transition-all relative flex flex-col h-full">
                            <h3 className="text-2xl lg:text-2xl 2xl:text-4xl font-bold text-foreground mb-1 lg:mb-1 uppercase tracking-wider">Free</h3>
                            <div className="text-xl lg:text-xl 2xl:text-3xl font-black text-muted-foreground mb-3 lg:mb-3 font-mono">{currency}0.00/mo</div>
                            <p className="text-lg lg:text-lg 2xl:text-2xl text-foreground font-medium mb-6 lg:mb-6 2xl:mb-10">The Essentials</p>

                            <ul className="space-y-3 lg:space-y-3 2xl:space-y-5 text-center text-base lg:text-base 2xl:text-xl flex-1 mx-auto">
                                <li className="text-foreground font-bold">Curated Roadmaps</li>
                                <li className="text-foreground font-bold">Oracle Guidance</li>
                                <li className="text-foreground font-bold">Curated Guilds</li>
                                <li className="text-foreground font-bold">Access to The Dungeons</li>
                                <li className="text-foreground font-bold">Weekly Events</li>
                            </ul>
                        </div>

                        {/* Pro Tier */}
                        <div className="bg-primary dark:bg-[#262626] text-primary-foreground dark:text-white border-2 border-primary-foreground/20 dark:border-white/20 rounded-3xl p-6 lg:p-8 md:p-12 2xl:p-14 shadow-2xl hover:shadow-primary/50 dark:hover:shadow-white/10 transition-all relative flex flex-col h-full">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#4F6B43] text-white px-3 py-0.5 lg:px-3 lg:py-0.5 2xl:px-5 2xl:py-1.5 rounded-full text-xs lg:text-[10px] 2xl:text-lg font-bold shadow-lg uppercase tracking-wide border border-[#35492d]">Recommended</div>
                            <h3 className="text-2xl lg:text-2xl 2xl:text-4xl font-bold text-[#faf6f0] mb-1 lg:mb-1 uppercase tracking-wider">Pro</h3>
                            <div className="text-xl lg:text-xl 2xl:text-3xl font-black text-muted-white mb-3 lg:mb-3 font-mono">{currency}{price}<span className="text-lg lg:text-lg 2xl:text-2xl text-white/50">/mo</span></div>
                            <p className="text-[#faf6f0]/80 font-medium mb-6 lg:mb-6 text-lg lg:text-lg 2xl:text-2xl 2xl:mb-10">The Full Experience</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 lg:gap-y-3 2xl:gap-y-5 text-center text-base lg:text-base 2xl:text-xl flex-1 mx-auto">
                                <div className="text-white font-bold">Custom Goals & Roadmaps</div>
                                <div className="text-white font-bold">Higher Oracle limits</div>
                                <div className="text-white font-bold">Premium Guilds access</div>
                                <div className="text-white font-bold">Start your own Guild</div>
                                <div className="text-white font-bold">Access to Referral Program</div>
                                <div className="text-white font-bold">Free Dungeon Keys</div>
                                <div className="text-white font-bold">Premium Weekly Events</div>
                                <div className="text-white font-bold">Direct access to the Developers </div>
                                <div className="text-white font-bold">Early access to new features </div>
                                <div className="text-white font-bold md:col-span-2 text-center mt-2">and many more perks</div>
                            </div>
                        </div>
                    </div>

                    <Link href="/login">
                        <Button className="h-14 lg:h-14 2xl:h-20 px-12 lg:px-12 2xl:px-20 text-xl lg:text-xl 2xl:text-3xl font-bold shadow-xl bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] text-white hover:brightness-110 transition-all hover:scale-105 rounded-xl border-2 border-[#35492d]">
                            Become a Questr
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
