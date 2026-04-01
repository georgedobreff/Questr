"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

const MESSAGES = [
  "Forging your Path...",
  "Consulting the High Elves...",
  "Rolling for initiative...",
  "Sharpening the swords...",
  "Gathering mana crystals...",
  "The Oracle is reviewing your application...",
  "Summoning the Syllabus Spirit...",
  "Calculating XP curves...",
  "Polishing the loot...",
  "This is taking too long...",
  "Asking the Oracle for directions...",
  "Loading the University archives...",
  "Brewing a potion of productivity...",
  "Equipping your starter gear...",
];

export default function ForgingLoader() {
  const { resolvedTheme } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);
  const iconFolder = resolvedTheme === 'light' ? 'black' : 'white';

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <p className="text-lg text-muted-foreground mb-8 animate-pulse font-medium">
        This may take a minute. Go grab a drink.
      </p>
      <div className="relative w-32 h-32">
        <>
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#5c3d2e]"
            style={{
              maskImage: `url(/assets/items/black/anvil.png)`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: `url(/assets/items/black/anvil.png)`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
          />
          <div
            className="absolute -top-8 left-8 -translate-x-1/2 w-20 h-20 origin-bottom-left animate-hammer bg-[#5c3d2e]"
            style={{
              maskImage: `url(/assets/items/black/3d-hammer.png)`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: `url(/assets/items/black/3d-hammer.png)`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
          />
        </>
      </div>
      <p className="text-xl font-semibold mt-4 animate-pulse min-w-[300px] text-center px-4">
        {MESSAGES[messageIndex]}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Please do not close this window.
      </p>
    </div>
  );
}
