import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Crown, Medal, Coins } from "lucide-react";

export default async function LeaderboardPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");


  const { data: topXP, error: xpError } = await supabase.rpc("get_leaderboard", {
    sort_by: "xp",
    limit_count: 50,
  });


  const { data: topCoins, error: coinsError } = await supabase.rpc("get_leaderboard", {
    sort_by: "coins",
    limit_count: 50,
  });

  if (xpError || coinsError) {
    console.error(xpError, coinsError);
    return <div className="p-4 text-red-500">Failed to load leaderboards.</div>;
  }

  const RenderRankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="font-bold text-muted-foreground w-6 text-center">{rank}</span>;
  };

  interface LeaderboardProfile {
    id: string;
    full_name: string | null;
    level: number;
    xp: number;
    coins: number;
  }

  const LeaderboardList = ({ items, type }: { items: LeaderboardProfile[], type: 'xp' | 'coins' }) => (
    <div className="space-y-2">
      {items.map((profile: LeaderboardProfile, index: number) => {
        const rank = index + 1;
        const isCurrentUser = profile.id === user.id;
        
        return (
          <div 
            key={profile.id}
            className={`flex items-center p-3 rounded-lg border ${
              isCurrentUser ? "bg-primary/10 border-primary" : "titled-cards border-border"
            }`}
          >
            <div className="flex items-center justify-center w-10 mr-4">
              <RenderRankIcon rank={rank} />
            </div>
            
            <div className="flex-grow">
              <p className={`font-semibold ${isCurrentUser ? "text-primary" : ""}`}>
                {profile.full_name || "Anonymous Pathfinder"}
              </p>
              {type === 'xp' && <p className="text-xs text-muted-foreground">Level {profile.level}</p>}
            </div>

            <div className="font-mono font-bold text-lg">
              {type === 'xp' ? (
                <span className="text-blue-500">{profile.xp.toLocaleString()} XP</span>
              ) : (
                <div className="flex items-center gap-1 text-yellow-500">
                  <Coins className="h-4 w-4 fill-current" />
                  {profile.coins.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <Tabs defaultValue="xp" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="xp">Level</TabsTrigger>
          <TabsTrigger value="coins">Coins</TabsTrigger>
        </TabsList>
        
        <TabsContent value="xp">
          <Card>
            <CardHeader>
              <CardTitle>Most Experienced Adventurers</CardTitle>
            </CardHeader>
            <CardContent>
              <LeaderboardList items={topXP || []} type="xp" />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="coins">
          <Card>
            <CardHeader>
              <CardTitle>Wealthiest Adventurers</CardTitle>
            </CardHeader>
            <CardContent>
              <LeaderboardList items={topCoins || []} type="coins" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


