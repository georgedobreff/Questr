"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimePostgresChangesPayload, RealtimeChannel, AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Notification } from "@/lib/types";

export default function NotificationsProvider() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupSubscription = (userId: string) => {
      if (channel) {
        supabase.removeChannel(channel);
      }

      console.log(`[NotificationsProvider] Subscribing to toasts for user ${userId}...`);

      channel = supabase
        .channel(`user-notifications-toast-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload: RealtimePostgresChangesPayload<Notification>) => {
            const notif = payload.new as Notification;
            if (!notif || !notif.title) return;
            const link = notif.action_link;
            if (notif.type === 'reward' || notif.type === 'success') {
              toast.success(notif.title, {
                description: notif.message,
                action: link ? { label: "View", onClick: () => router.push(link) } : undefined,
                duration: 5000,
              });
            } else if (notif.type === 'warning') {
              toast.warning(notif.title, {
                description: notif.message,
                action: link ? { label: "View", onClick: () => router.push(link) } : undefined
              });
            } else {
              toast.info(notif.title, {
                description: notif.message,
                action: link ? { label: "View", onClick: () => router.push(link) } : undefined
              });
            }
          }
        )
        .subscribe();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setupSubscription(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      }
    });

    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      if (user) setupSubscription(user.id);
    });

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  return null;
}
