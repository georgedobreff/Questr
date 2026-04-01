"use client";

import { useState } from "react";
import { Plus, ArrowUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Stat {
  name: string;
  value: number;
  buff: number;
}

interface StatsManagerProps {
  initialStats: Stat[];
  initialSkillPoints: number;
}

export default function StatsManager({ initialStats, initialSkillPoints }: StatsManagerProps) {
  const [stats, setStats] = useState(initialStats);
  const [skillPoints, setSkillPoints] = useState(initialSkillPoints);
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSpendPoint = async (statName: string) => {
    if (skillPoints <= 0 || loading) return;

    setLoading(statName);
    const previousStats = [...stats];
    const previousPoints = skillPoints;

    setStats(current =>
      current.map(s => s.name === statName ? { ...s, value: s.value + 1 } : s)
    );
    setSkillPoints(p => p - 1);

    try {
      const { error } = await supabase.rpc('spend_skill_point', { p_stat_name: statName });

      if (error) {
        throw error;
      }

      toast.success(`Upgraded ${statName}!`);
      router.refresh();
    } catch (err: unknown) {
      const error = err as Error;
      setStats(previousStats);
      setSkillPoints(previousPoints);
      const isTech = error.message.includes("Functions") || error.message.includes("Edge Function") || error.message.includes("fetch");
      toast.error(isTech ? "Something went wrong. Try again." : error.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm titled-cards relative">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="w-8"></div>

        <h2 className="text-2xl font-bold text-center">Stats</h2>

        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors",
            skillPoints > 0
              ? "bg-[#4F6B43]/80 text-white border border-[#4F6B43] shadow-[0_0_10px_rgba(79,107,67,0.5)]"
              : "bg-muted text-muted-foreground border border-transparent"
          )}
          title="Available Skill Points"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{skillPoints}</span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {(stats.length > 0) ? (
          stats.map((stat) => (
            <div key={stat.name} className="flex justify-between items-center w-full max-w-[280px] py-2 border-b border-white/20 last:border-0">
              <p className="font-semibold text-base">{stat.name}</p>

              <div className="flex items-center gap-2">
                <p className="font-mono">
                  {stat.value}
                  {stat.buff > 0 && <span className="text-green-500 ml-1 text-xs">(+{stat.buff})</span>}
                  {stat.buff < 0 && <span className="text-red-500 ml-1 text-xs">({stat.buff})</span>}
                </p>

                {skillPoints > 0 && (
                  <Button
                    size="icon"
                    className="h-4 w-4 rounded-full border border-[#4F6B43] text-[#4F6B43] bg-transparent hover:bg-[#4F6B43] hover:text-white ml-2 transition-all p-0 shadow-none"
                    onClick={() => handleSpendPoint(stat.name)}
                    disabled={loading !== null}
                  >
                    {loading === stat.name ? (
                      <span className="animate-spin h-2 w-2 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Plus className="w-2.5 h-2.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">No stats found.</p>
        )}
      </div>
    </div>
  );
}
