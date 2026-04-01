import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Subscription {
    user_id: string;
    stripe_current_period_end: string;
}

Deno.serve(async (req: Request) => {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const startWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
    const endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // +25h

    try {
        const { data: subscriptions, error } = await supabase
            .from('subscriptions')
            .select('user_id, stripe_current_period_end')
            .eq('status', 'trialing')
            .gte('stripe_current_period_end', startWindow.toISOString())
            .lt('stripe_current_period_end', endWindow.toISOString());

        if (error) throw error;

        const subs = subscriptions as Subscription[];
        console.log(`Found ${subs.length} trials ending soon.`);

        if (subs.length === 0) {
            return new Response(JSON.stringify({ message: 'No expiring trials found.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        const notifications = subs.map(sub => ({
            user_id: sub.user_id,
            title: 'Trial Ends Tomorrow',
            message: 'Your trial ends tomorrow. Upgrade to continue your journey.',
            type: 'alert',
            action_link: '/settings?trigger_upgrade=true' 
        }));

        const { error: insertError } = await supabase
            .from('notifications')
            .insert(notifications);

        if (insertError) throw insertError;

        return new Response(JSON.stringify({ message: `Notified ${subs.length} users.` }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error checking trial expiration:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
