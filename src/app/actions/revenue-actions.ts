'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getGuildMasterRevenueData() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };


    const { data: balanceCents, error: balanceError } = await supabase
        .rpc('get_guild_master_balance', { master_id: user.id });

    if (balanceError) {
        return { success: false, error: balanceError.message };
    }


    const { data: ledger, error: ledgerError } = await supabase
        .from('master_revenue_ledgers')
        .select(`
            id,
            amount_cents,
            description,
            created_at,
            source_user:profiles!master_revenue_ledgers_source_user_id_fkey(full_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);


    const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    return {
        success: true,
        data: {
            balanceCents: balanceCents || 0,
            ledger: ledger || [],
            withdrawals: withdrawals || []
        }
    };
}

export async function requestWithdrawal(amountCents: number) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    if (amountCents <= 0) {
        return { success: false, error: 'Amount must be greater than zero.' };
    }


    const { data, error } = await supabase.rpc('request_withdrawal', {
        p_amount_cents: amountCents
    });

    if (error) {
        console.error('Error requesting withdrawal:', error);
        return { success: false, error: 'Failed to process withdrawal request.' };
    }


    if (data && !data.success) {
        return { success: false, error: data.error };
    }

    revalidatePath('/guilds/revenue');
    return { success: true };
}
