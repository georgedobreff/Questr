"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel, RealtimePostgresChangesPayload, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import {
  Settings as SettingsIcon,
  LogOut,
  HelpCircle,
  Flame,
  ScrollText,
  PawPrint,
  Store,
  Sparkles,
  Map,
  User,
  UserCircle,
  Download,
  Swords,
  BookOpen,
  Users,
  LayoutDashboard,
  MessageCircle,
  Sun,
  Moon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import NotificationsDropdown from "./notifications-dropdown";
import FeedbackDialog from "../../feedback-dialog";
import { useGoPro } from "@/hooks/use-go-pro";
import { usePWA } from "@/app/services/pwa-provider";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/navigation/dropdown-menu";

export default function Navbar() {
  const pathname = usePathname();
  const supabase = createClient();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [hasHadTrial, setHasHadTrial] = useState(false);
  const [streak, setStreak] = useState(0);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { handleGoPro } = useGoPro();
  const { isInstallable, install } = usePWA();


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let currentUserId: string | null = null;

    const setupRealtime = async (userId: string) => {

      if (currentUserId === userId) return;
      currentUserId = userId;


      const [subscriptionRes, profileRes] = await Promise.all([
        supabase.from("subscriptions").select("status").eq("user_id", userId).single(),
        supabase.from("profiles").select("current_streak, has_had_trial, guild_id").eq("id", userId).single()
      ]);

      if (subscriptionRes.data) {
        setUserStatus(subscriptionRes.data.status);
      } else {
        setUserStatus('free');
      }

      if (profileRes.data) {
        setStreak(profileRes.data.current_streak || 0);
        setHasHadTrial(profileRes.data.has_had_trial || false);
        setGuildId(profileRes.data.guild_id);
      }


      if (channel) supabase.removeChannel(channel);


      channel = supabase
        .channel(`navbar-user-updates-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            const newProfile = payload.new;
            if (newProfile) {
              if (newProfile.current_streak !== undefined) setStreak(newProfile.current_streak);
              if (newProfile.has_had_trial !== undefined) setHasHadTrial(newProfile.has_had_trial);
              if (newProfile.guild_id !== undefined) setGuildId(newProfile.guild_id);
            }
          }
        )
        .subscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setupRealtime(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        currentUserId = null;
        setStreak(0);
        setGuildId(null);
        if (channel) {
          await supabase.removeChannel(channel);
          channel = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const handleGuildStatusChange = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("guild_id")
          .eq("id", user.id)
          .single();

        if (data) {
          setGuildId(data.guild_id);
        }
      }
    };

    window.addEventListener('guild_status_changed', handleGuildStatusChange);
    return () => window.removeEventListener('guild_status_changed', handleGuildStatusChange);
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };



  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "nav-dashboard" },
    { href: "/log", label: "Quest", icon: ScrollText, id: "nav-quest" },
    { href: "/path", label: "Map", icon: Map, id: "nav-map" },
    { href: "/oracle", label: "Oracle", icon: Sparkles, id: "nav-oracle" },
    { href: "/pet", label: "Companion", icon: PawPrint, id: "nav-companion" },
    { href: guildId ? `/guilds/${guildId}` : "/guilds", label: "Guild", icon: Users, id: "nav-guilds" },
    { href: "/adventure", label: "Dungeon", icon: Swords, id: "nav-dungeon" },
    // { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  const ThemeToggle = () => {
    if (!mounted) return <div className="h-8 w-8" />;
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="text-muted-foreground hover:text-primary transition-colors"
        title="Toggle Theme"
      >
        {resolvedTheme === 'dark' ? <Sun className="h-7 w-7" /> : <Moon className="h-7 w-7" />}
      </Button>
    );
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 lg:relative lg:top-auto lg:left-auto lg:right-auto lg:h-full lg:w-64 lg:border-r landscape:relative landscape:top-auto landscape:left-auto landscape:right-auto landscape:h-full landscape:w-64 landscape:border-r navbar-textured border-b lg:border-none landscape:border-none z-50 px-4 flex lg:flex-col landscape:flex-col items-center transition-colors">
        <FeedbackDialog isOpen={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />

        {/* Mobile Layout - hidden on lg and landscape */}
        <div className="flex lg:hidden landscape:hidden w-full h-16 items-center">
          {/* Left: Streak & Theme Switch */}
          <div id="nav-streak-mobile" className="flex-1 flex justify-start items-center gap-2 text-[#4F6B43] font-bold" title="Daily Streak">
            <Flame className="h-5 w-5 fill-current " />
            <span className="mr-1">{streak}</span>
            <ThemeToggle />
          </div>


          {/* Center: Logo */}
          <div className="flex-none">
            <Link href="/dashboard">
              <div className="flex items-center justify-center w-full relative">
                <span className="text-2xl font-bold mt-1 tracking-widest" style={{
                  fontFamily: 'var(--font-medieval-sharp)',
                  color: 'var(--primary)',
                  WebkitTextStroke: '1.2px var(--primary)',
                  textShadow: '0 0 2px var(--primary)'
                }}>QUESTR</span>
                <span className="absolute -top-1 -right-3 text-[9px] font-bold text-muted-foreground tracking-widest opacity-75">BETA</span>
              </div>
            </Link>
          </div>

          {/* Right: Notifications & Profile */}
          <div id="nav-actions-mobile" className="flex-1 flex justify-end items-center gap-3">
            <NotificationsDropdown />

            <DropdownMenu>
              <DropdownMenuTrigger asChild id="nav-profile-trigger-mobile">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <UserCircle className="h-9 w-9" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-xl w-56">
                {userStatus !== null && !['active', 'trialing', 'pro'].includes(userStatus) && (
                  <div className="p-2 border-b">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        handleGoPro();
                      }}
                      className="w-full bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white border-none rounded-full h-8"
                    >
                      Upgrade
                    </Button>
                  </div>
                )}
                <DropdownMenuItem asChild>
                  <Link id="nav-shop-dropdown-mobile" href="/path" className="cursor-pointer w-full flex items-center">
                    <Map className="mr-2 h-4 w-4" />
                    <span>Map</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link id="nav-character-dropdown-mobile" href="/character" className="cursor-pointer w-full flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Character</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/adventure" className="cursor-pointer w-full flex items-center">
                    <Swords className="mr-2 h-4 w-4" />
                    <span>Dungeon</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer w-full flex items-center">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsFeedbackOpen(true)} className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Feedback</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="https://discord.gg/r7Q59j7gqH" target="_blank" rel="noopener noreferrer" className="cursor-pointer w-full flex items-center">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    <span>Discord</span>
                  </Link>
                </DropdownMenuItem>
                {isInstallable && (
                  <DropdownMenuItem onClick={install} className="cursor-pointer">
                    <Download className="mr-2 h-4 w-4" />
                    <span>Install App</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop Layout (Standard flex) - visible on lg and landscape */}
        <div className="hidden lg:flex landscape:flex w-full h-full flex-col items-center py-8">
          <div className="w-full flex justify-center mb-6">
            <Link href="/dashboard">
              <div className="flex items-center gap-0.5 relative">
                <span className="text-2xl font-bold mt-1 tracking-widest" style={{
                  fontFamily: 'var(--font-medieval-sharp)',
                  color: 'var(--primary)',
                  WebkitTextStroke: '1.2px var(--primary)',
                  textShadow: '0 0 2px black'
                }}>QUESTR</span>
                <span className="absolute -top-2 -right-8 text-[10px] font-bold text-muted-foreground tracking-widest opacity-75">BETA</span>
              </div>
            </Link>
          </div>

          {/* Actions Row (Logout, Theme Switch, Streak, Notifications) */}
          <div className="w-full flex items-center justify-between px-6 mb-6">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors p-0"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-8 w-8" />
            </Button>

            <ThemeToggle />

            <div id="nav-streak-desktop" className="flex items-center gap-1 text-[#4F6B43] font-bold cursor-help" title="Daily Streak">
              <Flame className="h-5 w-5 fill-current" />
              <span className="text-lg leading-none">{streak}</span>
            </div>

            <div id="nav-notifications-desktop">
              <NotificationsDropdown />
            </div>
          </div>

          {userStatus !== null && !['active', 'trialing', 'pro'].includes(userStatus) && (
            <div className="w-full mb-4 px-4">
              <Button
                onClick={() => handleGoPro()}
                className="w-full bg-[radial-gradient(circle_at_center,#4F6B43,#35492d)] hover:brightness-110 text-white border-none rounded-full"
              >
                Upgrade
              </Button>
            </div>
          )}

          <div id="nav-links-container" className="flex flex-col w-full h-full items-start gap-1 overflow-y-auto px-2 pt-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                id={link.id}
                href={link.href}
                className={`group w-full py-2.5 px-4 flex items-center gap-3 transition-all duration-200 rounded-lg hover:bg-primary/5 ${pathname === link.href
                  ? "text-primary font-extrabold bg-primary/10"
                  : "text-muted-foreground font-medium text-sm"
                  }`}>
                <link.icon className={`h-5 w-5 transition-all duration-200 group-hover:scale-110 ${pathname === link.href ? "stroke-[3px] scale-110" : ""}`} />
                <span className="text-[15px]">{link.label}</span>
              </Link>
            ))}


            {/* Profile Section Links */}
            <Link
              href="/character"
              className={`group w-full py-2.5 px-4 flex items-center gap-3 transition-all duration-200 rounded-lg hover:bg-primary/5 ${pathname === "/character" ? "text-primary font-extrabold bg-primary/10" : "text-muted-foreground font-medium text-sm"}`}
            >
              <User className="h-5 w-5" />
              <span className="text-[15px]">Character</span>
            </Link>

            <Link
              href="/settings"
              className={`group w-full py-2.5 px-4 flex items-center gap-3 transition-all duration-200 rounded-lg hover:bg-primary/5 ${pathname === "/settings" ? "text-primary font-extrabold bg-primary/10" : "text-muted-foreground font-medium text-sm"}`}
            >
              <SettingsIcon className="h-5 w-5" />
              <span className="text-[15px]">Settings</span>
            </Link>

            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="group w-full py-2.5 px-4 flex items-center gap-3 transition-all duration-200 rounded-lg hover:bg-primary/5 text-muted-foreground font-medium text-sm outline-none"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="text-[15px]">Feedback</span>
            </button>

            <Link
              href="https://discord.gg/r7Q59j7gqH"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-full py-2.5 px-4 flex items-center gap-3 transition-all duration-200 rounded-lg hover:bg-primary/5 text-muted-foreground font-medium text-sm"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-[15px]">Discord</span>
            </Link>

            {isInstallable && (
              <button
                onClick={install}
                className="group w-full py-2.5 px-4 flex items-center gap-3 transition-all duration-200 rounded-lg hover:bg-primary/5 text-muted-foreground font-medium text-sm outline-none"
              >
                <Download className="h-5 w-5" />
                <span className="text-[15px]">Install App</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div id="nav-mobile-container" className="lg:hidden landscape:hidden fixed bottom-0 left-0 w-full bg-background border-t z-50 flex justify-between items-center h-20 pb-3 px-1">
        <Link id="nav-dashboard-mobile" href="/dashboard" className={`flex-1 flex flex-col items-center justify-center h-full ${pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground'}`}>
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[9px] mt-1">Dashboard</span>
        </Link>
        <Link id="nav-quest-mobile" href="/log" className={`flex-1 flex flex-col items-center justify-center h-full ${pathname === '/log' ? 'text-primary' : 'text-muted-foreground'}`}>
          <ScrollText className="h-5 w-5" />
          <span className="text-[9px] mt-1">Quest</span>
        </Link>
        <Link id="nav-oracle-mobile" href="/oracle" className={`flex-1 flex flex-col items-center justify-center h-full ${pathname === '/oracle' ? 'text-primary' : 'text-muted-foreground'}`}>
          <Sparkles className="h-6 w-6" />
          <span className="text-[9px] mt-1">Oracle</span>
        </Link>
        <Link id="nav-companion-mobile" href="/pet" className={`flex-1 flex flex-col items-center justify-center h-full ${pathname === '/pet' ? 'text-primary' : 'text-muted-foreground'}`}>
          <PawPrint className="h-5 w-5" />
          <span className="text-[9px] mt-1">Companion</span>
        </Link>
        <Link id="nav-guilds-mobile" href={guildId ? `/guilds/${guildId}` : "/guilds"} className={`flex-1 flex flex-col items-center justify-center h-full ${pathname.startsWith('/guilds') ? 'text-primary' : 'text-muted-foreground'}`}>
          <Users className="h-5 w-5" />
          <span className="text-[9px] mt-1">Guild</span>
        </Link>
      </div>
    </>
  );
}
