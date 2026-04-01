"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/ui/site-footer";
import { Hero } from "@/components/ui/landing/hero";
import { HowItWorks } from "@/components/ui/landing/how-it-works";
import { Features } from "@/components/ui/landing/features";
import { WhyQuest } from "@/components/ui/landing/why-quest";
import { Pricing } from "@/components/ui/landing/pricing";
import { About } from "@/components/ui/landing/about";
import { ThemeToggle } from "@/components/ui/navigation/theme-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen text-foreground bg-background selection:bg-primary/20 flex flex-col relative">
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-multiply dark:hidden"
        style={{ backgroundImage: `url('/assets/textures/paper_texture.jpg')`, backgroundSize: 'cover' }}
      />
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-background shadow-sm">
        <div className="container mx-auto flex h-16 lg:h-14 2xl:h-20 items-center justify-between px-4 2xl:px-8">
          <Link href="/" className="flex items-center">
            <div className="flex items-center justify-center relative">
              <span className="text-3xl lg:text-2xl 2xl:text-4xl font-bold mt-1 tracking-widest" style={{
                fontFamily: 'var(--font-medieval-sharp)',
                color: 'var(--primary)',
                WebkitTextStroke: '1.2px var(--primary)',
                textShadow: '0 0 2px black'
              }}>QUESTR</span>
              <span className="absolute -top-1 -right-8 text-[10px] font-bold text-muted-foreground tracking-widest opacity-75">BETA</span>
            </div>
          </Link>
          <div className="flex items-center gap-6 lg:gap-6 2xl:gap-12">
            <ThemeToggle />
            <Link href="/login">
              <Button className="bg-primary text-white dark:text-black hover:brightness-110 shadow-md rounded-full px-6 py-4 lg:px-5 lg:py-3 2xl:px-8 2xl:py-6 text-lg lg:text-base 2xl:text-xl font-bold">Log in</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 z-10">
        <Hero />
        <About />
        <HowItWorks />
        <WhyQuest />
        <Features />
        <Pricing />
      </main>

      <SiteFooter />
    </div>
  );
}
