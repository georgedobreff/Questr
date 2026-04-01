"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimePostgresChangesPayload, RealtimeChannel, AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { Bell, BellDot, Check, Trash2, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/navigation/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Notification } from "@/lib/types";

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
}

export default function NotificationsDropdown() {
  const supabase = createClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUserId(session?.user?.id || null);
    });

    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUserId(user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const fetchNotifications = async (id: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const typedData = data as Notification[];
      setNotifications(typedData);
      setUnreadCount(typedData.filter((n: Notification) => !n.is_read).length);
    }
  };

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let channel: RealtimeChannel;

    const setupSubscription = () => {
      fetchNotifications(userId);

      console.log(`[Notifications] Subscribing for user ${userId}...`);

      channel = supabase
        .channel(`user-notifications-dropdown-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload: RealtimePostgresChangesPayload<Notification>) => {
            if (payload.eventType === 'INSERT') {
              const newNotif = payload.new as Notification;
              setNotifications(prev => [newNotif, ...prev].slice(0, 20));
              if (!newNotif.is_read) {
                setUnreadCount(prev => prev + 1);
              }
            } else {
              fetchNotifications(userId);
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const markAsRead = async (id: number) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (userId) fetchNotifications(userId);
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    fetchNotifications(userId);
  };

  const clearAll = async () => {
    if (!userId) return;
    await supabase.from("notifications").delete().eq("user_id", userId);
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleAction = (notif: Notification) => {
    markAsRead(notif.id);
    const link = notif.action_link;
    if (link) {
      router.push(link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellDot className="h-5 w-5 text-primary" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white dark:text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-background border shadow-xl">
        <div className="flex items-center justify-between px-4 py-2 font-semibold text-sm">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={(e: React.MouseEvent) => { e.preventDefault(); markAllAsRead(); }}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto flex flex-col gap-[1px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((notif: Notification) => (
              <DropdownMenuItem
                key={notif.id}
                onClick={() => handleAction(notif)}
                className={`p-4 cursor-pointer flex flex-col items-start gap-1 focus:bg-muted/50 border border-white/10 rounded-md ${!notif.is_read ? 'bg-primary/5' : ''}`}
              >
                <div className="flex w-full justify-between items-start">
                  <span className={`font-bold text-xs ${!notif.is_read ? 'text-primary' : ''}`}>
                    {notif.title}
                  </span>
                  <span className="text-[10px] opacity-50">
                    {timeAgo(new Date(notif.created_at))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {notif.message}
                </p>
                {notif.action_link && (
                  <div className="flex items-center gap-1 text-[10px] text-primary mt-1 font-medium">
                    <ExternalLink className="h-3 w-3" />
                    <span>Click to view</span>
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-destructive"
            onClick={clearAll}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Clear All
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
