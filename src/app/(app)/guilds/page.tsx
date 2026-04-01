import { getPublicGuilds } from '@/app/actions/guild-actions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GuildsClientPage } from './guilds-client-page';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function GuildsPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const [profileRes, guildsRes] = await Promise.all([
        supabase
            .from('profiles')
            .select('guild_id')
            .eq('id', user.id)
            .single(),
        getPublicGuilds()
    ]);

    const { data: profile } = profileRes;
    const guilds = guildsRes;

    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle();

    const isPro = !!subscription;

    return (
        <GuildsClientPage
            guilds={guilds}
            currentGuildId={profile?.guild_id ?? null}
            isPro={isPro}
        />
    );
}
