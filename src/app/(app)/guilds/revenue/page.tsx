import { getGuildMasterRevenueData } from '@/app/actions/revenue-actions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RevenueDashboard } from '@/components/guilds/revenue-dashboard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
    title: 'Guild Revenue | Questr',
    description: 'Manage your guild revenue and withdrawals.'
};

export default async function GuildRevenuePage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check if the user is actually a guild master
    const { data: profile } = await supabase
        .from('profiles')
        .select('guild_id')
        .eq('id', user.id)
        .single();
    
    if (profile?.guild_id) {
         const { data: guild } = await supabase
            .from('guilds')
            .select('master_id')
            .eq('id', profile.guild_id)
            .single();
        
        if (guild?.master_id !== user.id) {
            redirect(`/guilds/${profile.guild_id}`); // Redirect members back to guild
        }
    } else {
        redirect('/guilds');
    }

    const revenueResult = await getGuildMasterRevenueData();

    if (!revenueResult.success || !revenueResult.data) {
        return (
            <div className="container mx-auto pt-24 pb-12 flex flex-col items-center text-center space-y-4">
                <h1 className="text-2xl font-bold text-destructive">Error Loading Revenue Data</h1>
                <p className="text-muted-foreground">{revenueResult.error || 'Unknown error occurred.'}</p>
                <Link href={`/guilds/${profile.guild_id}`}>
                    <Button variant="outline">Return to Guild</Button>
                </Link>
            </div>
        );
    }

    const { balanceCents, ledger, withdrawals } = revenueResult.data;

    return (
        <div className="container max-w-5xl mx-auto pt-24 lg:pt-32 pb-24 lg:pb-12 px-4 space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/guilds/${profile.guild_id}`}>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-uncial-antiqua)' }}>
                        Guild Revenue Vault
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your guild earnings and request payouts.
                    </p>
                </div>
            </div>

            <RevenueDashboard 
                balanceCents={balanceCents}
                ledger={ledger}
                withdrawals={withdrawals}
            />
        </div>
    );
}
