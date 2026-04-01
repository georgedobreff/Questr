"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function Hero() {
    const heroRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (heroRef.current) {
            // Hero fade-in animation
            gsap.fromTo(
                heroRef.current.querySelectorAll(".hero-animate"),
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 1, ease: "power2.out", stagger: 0.15 }
            );
        }

        // Refresh ScrollTrigger after a short delay
        const timer = setTimeout(() => {
            ScrollTrigger.refresh();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section
            ref={heroRef}
            className="sticky top-0 left-0 w-full min-h-[100svh] z-1 flex items-center justify-center overflow-hidden py-20 bg-white dark:bg-background"
        >
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0 pointer-events-none opacity-13 dark:opacity-5 dark:grayscale"
                style={{
                    backgroundImage: `url('/assets/textures/hero_background.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />

            {/* Paper Texture Overlay */}
            <div
                className="absolute inset-0 z-1 pointer-events-none opacity-44 mix-blend-multiply dark:hidden"
                style={{ backgroundImage: `url('/assets/textures/paper_texture.jpg')`, backgroundSize: 'cover' }}
            />



            <div className="relative z-30 text-center space-y-6 lg:space-y-6 2xl:space-y-12 w-full max-w-3xl lg:max-w-3xl 2xl:max-w-5xl px-4">
                {/* Main Headline */}
                <h1
                    className="text-4xl lg:text-5xl 2xl:text-8xl text-primary bg-clip-text drop-shadow-sm hero-animate"
                    style={{ fontFamily: 'var(--font-uncial-antiqua)' }}
                >
                    The Quest for Mastery
                </h1>

                {/* Subheadline */}
                <p className="max-w-xl lg:max-w-xl 2xl:max-w-4xl mx-auto text-xl lg:text-xl 2xl:text-4xl text-muted-foreground leading-relaxed font-medium hero-animate">
                    Learn any skill as a game with clear objectives, real challenges, and dedicated support.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 lg:gap-4 2xl:gap-8 justify-center items-center pt-2 lg:pt-2 2xl:pt-8 hero-animate">
                    <Link href="/login">
                        <Button className="h-14 lg:h-14 2xl:h-20 px-8 lg:px-8 2xl:px-14 text-lg lg:text-lg 2xl:text-2xl font-bold shadow-xl bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] text-white hover:brightness-110 transition-all hover:scale-105 rounded-xl border-2 border-[#35492d]">
                            Become a Questr <ArrowRight className="ml-2 h-5 w-5 2xl:h-7 2xl:w-7" />
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        onClick={(e) => scrollToSection(e, 'about')}
                        className="h-14 lg:h-14 2xl:h-20 px-8 lg:px-8 2xl:px-14 text-lg lg:text-lg 2xl:text-2xl font-bold border-2 border-white/20 text-primary hover:bg-primary hover:text-white rounded-xl backdrop-blur-sm"
                    >
                        Learn More
                    </Button>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-6 lg:bottom-4 2xl:bottom-24 left-1/2 -translate-x-1/2 z-30 hero-animate">
                <a
                    href="#about"
                    onClick={(e) => scrollToSection(e, 'about')}
                    className="flex flex-col items-center group transition-all duration-300"
                >
                    <div className="relative w-12 h-12 lg:w-14 lg:h-14 2xl:w-20 2xl:h-20 flex items-center justify-center">
                        {/* Pulsating Rings */}
                        <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping [animation-duration:3s]" />
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping [animation-delay:1.5s] [animation-duration:3s]" />

                        {/* Icon Container */}
                        <div className="relative w-12 h-12 lg:w-14 lg:h-14 2xl:w-20 2xl:h-20 rounded-full border-2 border-primary/20 flex items-center justify-center bg-background/60 backdrop-blur-md shadow-2xl group-hover:border-primary/50 group-hover:bg-background/90 transition-all duration-500">
                            <ChevronDown className="h-6 w-6 lg:h-7 lg:w-7 2xl:h-10 w-10 text-primary group-hover:translate-y-1.5 transition-transform duration-300" />
                        </div>
                    </div>
                </a>
            </div>
        </section>
    );
}
