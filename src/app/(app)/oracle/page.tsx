import { createServerSupabaseClient } from '@/lib/supabase/server';
import ChatInterface from './chat-client-page';
import { redirect } from 'next/navigation';

export default async function OraclePage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, chatHistoryRes, subscriptionRes] = await Promise.all([
    supabase.from('profiles').select('full_name, has_had_trial').eq('id', user.id).single(),
    supabase.from('chat_history').select('id, role, content').eq('user_id', user.id).order('created_at', { ascending: false }).limit(313),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle()
  ]);

  const profile = profileRes.data;
  const chatHistory = chatHistoryRes.data?.toReversed();
  const chatError = chatHistoryRes.error;
  const isPro = ['active', 'trialing', 'pro'].includes(subscriptionRes.data?.status || '');
  const hasHadTrial = profile?.has_had_trial || false;

  if (chatError) {
    console.error("Error fetching chat history:", chatError);
  }

  return (
    <div className="h-full flex flex-col items-center pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 px-4 overflow-hidden">
      <div id="oracle-container" className="w-full max-w-4xl grow h-full relative">
        <ChatInterface 
          initialMessages={chatHistory || []} 
          userName={profile?.full_name || 'Adventurer'} 
          isPro={isPro}
          hasHadTrial={hasHadTrial}
        />
      </div>
    </div>
  );

}
