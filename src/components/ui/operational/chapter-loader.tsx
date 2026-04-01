"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

const MESSAGES = [
  "Preparing your next Chapter...",
  "Turning the page...",
  "The Oracle is checking your grades...",
  "Writing the next chapter of your legend...",
  "Consulting the archives...",
  "Printing new quest parchments...",
  "Leveling up the difficulty...",
  "Scouting the road ahead...",
  "Refilling the inkwells...",
  "Unlocking new map regions...",
  "Calculating your XP curve...",
];

export default function ChapterLoader() {
  const { resolvedTheme } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);
  const iconFolder = resolvedTheme === 'dark' ? 'white' : 'black';

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <div className="relative w-32 h-32">
        {iconFolder === 'black' ? (
          <>
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary"
              style={{
                maskImage: `url(/assets/items/${iconFolder}/book.png)`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: `url(/assets/items/${iconFolder}/book.png)`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
              }}
            />
            <div
              className="absolute -top-8 left-8 -translate-x-1/2 w-20 h-20 origin-bottom-left animate-hammer bg-primary"
              style={{
                maskImage: `url(/assets/items/${iconFolder}/3d-hammer.png)`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: `url(/assets/items/${iconFolder}/3d-hammer.png)`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
              }}
            />
          </>
        ) : (
          <>
            <img
              src={`/assets/items/${iconFolder}/book.png`}
              alt="Book"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24"
              onError={(e) => {
                // Fallback if book icon doesn't exist, use anvil
                e.currentTarget.src = `/assets/items/${iconFolder}/anvil.png`;
              }}
            />
            {/* We can re-use the hammer or add a quill animation if we had one. 
                 For now, let's keep it simple or reuse the hammer hitting the book? 
                 Actually, let's just pulse the book or reuse the hammer for consistency "Forging the Chapter".
             */}
            <img
              src={`/assets/items/${iconFolder}/3d-hammer.png`}
              alt="Hammer"
              className="absolute -top-8 left-8 -translate-x-1/2 w-20 h-20 origin-bottom-left animate-hammer"
            />
          </>
        )}
      </div>
      <p className="text-xl font-semibold mt-4 animate-pulse min-w-[300px] text-center px-4">
        {MESSAGES[messageIndex]}
      </p>
    </div>
  );
}
