"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface Achievement {
  id: number;
  code: string;
  title: string;
  description: string;
  category: string;
  reward_xp: number;
  reward_coins: number;
  icon_name: string;
}

interface AchievementsListProps {
  achievements: Achievement[];
  unlockedIds: Set<number>;
}

export default function AchievementsList({ achievements, unlockedIds }: AchievementsListProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="animate-pulse h-40 bg-muted rounded-lg" />;
  }

  const iconFolder = resolvedTheme === "dark" ? "white" : "black";

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
      {achievements.map((achievement) => {
        const isUnlocked = unlockedIds.has(achievement.id);
        return (
          <Popover key={achievement.id}>
            <PopoverTrigger asChild>
              <div
                className={`relative group flex flex-col items-center justify-center h-14 p-1 rounded-lg border transition-all duration-200 cursor-pointer ${isUnlocked
                    ? "bg-secondary/20 border-transparent hover:bg-secondary/40"
                    : "bg-muted/10 border-transparent opacity-50 grayscale hover:opacity-75"
                  }`}
              >
                <div className="relative w-12 h-12">
                  {iconFolder === "black" ? (
                    <div
                      className="absolute inset-0 bg-primary"
                      style={{
                        maskImage: `url(/achievements/${iconFolder}/${achievement.icon_name}.png)`,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskImage: `url(/achievements/${iconFolder}/${achievement.icon_name}.png)`,
                        WebkitMaskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                      }}
                    />
                  ) : (
                    <Image
                      src={`/achievements/${iconFolder}/${achievement.icon_name}.png`}
                      alt={achievement.title}
                      fill
                      className="object-contain"
                    />
                  )}
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="max-w-xs text-center">
              <p className="font-bold">{achievement.title}</p>
              <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
              <div className="flex gap-2 justify-center text-xs">
                {achievement.reward_xp > 0 && <Badge variant="secondary" className="text-xs">+{achievement.reward_xp} XP</Badge>}
                {achievement.reward_coins > 0 && <Badge variant="secondary" className="text-xs">+{achievement.reward_coins} Coins</Badge>}
              </div>
              {!isUnlocked && <p className="text-xs text-red-400 mt-2 font-semibold">Locked</p>}
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
