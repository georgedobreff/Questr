import { createServerSupabaseClient } from '@/lib/supabase/server';
import AdventureChat from './adventure-chat';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdventurePage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, adventureStateRes, chatHistoryRes, subscriptionRes] = await Promise.all([
    supabase.from('profiles').select('full_name, action_points, dungeon_keys, has_had_trial').eq('id', user.id).single(),
    supabase.from('adventure_states').select('is_active, theme').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('adventure_chat_history').select('id, role, content').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle()
  ]);

  const profile = profileRes.data;
  const isDungeonActive = !!adventureStateRes.data;
  const dungeonPending = isDungeonActive && !adventureStateRes.data?.theme;
  const isPro = ['active', 'trialing', 'pro'].includes(subscriptionRes.data?.status || '');
  const hasHadTrial = profile?.has_had_trial || false;

  interface RawChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }
  const chatHistory = chatHistoryRes.data as RawChatMessage[] | null;

  interface Action {
    type: 'ROLL';
    stat: string;
    dc: number;
  }

  interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    action?: Action | null;
  }

  interface StructuredContent {
    message: string;
    action?: Action | null;
  }

  const parsedHistory: Message[] = (chatHistory || []).map(msg => {
    try {
      const parsed = JSON.parse(msg.content) as StructuredContent;
      if (parsed.message) {
        return { ...msg, content: parsed.message, action: parsed.action };
      }
      return msg as Message;
    } catch {
      return msg as Message;
    }
  });

  return (
    <div className="h-full flex flex-col items-center pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 px-4 overflow-hidden">
      <div id="dungeon-container" className="w-full max-w-4xl flex-grow h-full relative">
        <AdventureChat
          initialMessages={parsedHistory}
          userName={profile?.full_name || 'Adventurer'}
          initialActionPoints={profile?.action_points || 0}
          initialDungeonKeys={profile?.dungeon_keys || 0}
          isPro={isPro}
          hasHadTrial={hasHadTrial}
          initialDungeonActive={isDungeonActive}
          dungeonPending={dungeonPending}
        />
      </div>
    </div>
  );

}
