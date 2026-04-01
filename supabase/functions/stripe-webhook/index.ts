import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req: Request) => {
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
        return new Response('Webhook Error: Missing signature', { status: 400 });
    }

    try {
        const body = await req.text();
        const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: existingEvent } = await supabaseAdmin
            .from('processed_webhook_events')
            .select('id')
            .eq('stripe_event_id', event.id)
            .single();

        if (existingEvent) {
            return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
        }

        await supabaseAdmin
            .from('processed_webhook_events')
            .insert({ stripe_event_id: event.id });

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.user_id || session.client_reference_id;
                const customerId = session.customer as string;

                if (userId && customerId) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .upsert({
                            user_id: userId,
                            stripe_customer_id: customerId
                        }, { onConflict: 'user_id' });
                }

                const planCreditPriceId = Deno.env.get('PLAN_CREDIT_PRICE_ID');
                const dungeonKeyPriceId = Deno.env.get('DUNGEON_KEY_PRICE_ID');
                const petEnergyRefillPriceId = Deno.env.get('ENERGY_REFILL_PRICE_ID');
                const priceId = session.metadata?.price_id;

                if (userId && priceId === planCreditPriceId) {
                    await supabaseAdmin.rpc('increment_plan_credits', { user_id_input: userId, amount: 1 });
                    await supabaseAdmin.from('notifications').insert({
                        user_id: userId,
                        title: 'Purchase Successful',
                        message: '1 Plan Credit has been added to your account.',
                        type: 'success',
                        action_link: '/new-path'
                    });
                } else if (userId && priceId === dungeonKeyPriceId) {
                    await supabaseAdmin.rpc('add_dungeon_keys', { p_user_id: userId, p_amount: 1 });
                    await supabaseAdmin.from('notifications').insert({
                        user_id: userId,
                        title: 'Purchase Successful',
                        message: '1 Dungeon Key has been added to your inventory.',
                        type: 'success',
                        action_link: '/adventure'
                    });
                } else if (userId && priceId === petEnergyRefillPriceId) {
                    const { data: pet } = await supabaseAdmin.from('user_pets').select('id, nickname').eq('user_id', userId).eq('status', 'alive').maybeSingle();
                    if (pet) {
                        await supabaseAdmin.from('user_pets').update({ current_energy: 100, last_energy_refill_at: new Date().toISOString() }).eq('id', pet.id);
                        await supabaseAdmin.from('notifications').insert({
                            user_id: userId,
                            title: 'Energy Restored',
                            message: `${pet.nickname || 'Your companion'} is now at full energy!`,
                            type: 'success',
                            action_link: '/pet'
                        });
                    }
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const status = subscription.status;
                const customerId = subscription.customer as string;

                const { data: subRecord } = await supabaseAdmin
                    .from('subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (subRecord?.user_id) {
                    let currentPeriodEndStr = new Date().toISOString();
                    if (subscription.current_period_end) {
                        const dateObj = new Date(subscription.current_period_end * 1000);
                        if (!isNaN(dateObj.getTime())) {
                            currentPeriodEndStr = dateObj.toISOString();
                        }
                    }

                    const priceId = subscription.items?.data?.[0]?.price?.id || null;

                    const updatePayload = {
                        stripe_subscription_id: subscription.id,
                        stripe_price_id: priceId,
                        stripe_current_period_end: currentPeriodEndStr,
                        status: status,
                        updated_at: new Date().toISOString()
                    };

                    await supabaseAdmin
                        .from('subscriptions')
                        .update(updatePayload)
                        .eq('user_id', subRecord.user_id);

                    if (status === 'trialing' || status === 'active') {
                        await supabaseAdmin
                            .from('profiles')
                            .update({ has_had_trial: true })
                            .eq('id', subRecord.user_id);

                        // --- Referral System Logic ---
                        if (status === 'active') {
                            const { data: referralResult, error: referralError } = await supabaseAdmin
                                .rpc('apply_internal_referral_rewards', { p_user_id: subRecord.user_id });

                            if (!referralError && referralResult && referralResult.length > 0) {
                                const referrerId = referralResult[0].referrer_id;
                                console.log(`Referral confirmed! Reward granted to ${referrerId} for user ${subRecord.user_id}`);

                                try {
                                    const { data: referrerSub } = await supabaseAdmin
                                        .from('subscriptions')
                                        .select('stripe_subscription_id, stripe_customer_id')
                                        .eq('user_id', referrerId)
                                        .single();

                                    if (referrerSub && referrerSub.stripe_subscription_id) {
                                        const referrerStripeSub = await stripe.subscriptions.retrieve(referrerSub.stripe_subscription_id);
                                        const referrerStripeCustomer = await stripe.customers.retrieve(referrerSub.stripe_customer_id);

                                        const COUPON_ID = 'REFERRAL_1MO_FREE';

                                        // --- REFERRER LOGIC ---
                                        if (!referrerStripeCustomer.deleted && referrerStripeCustomer.discount) {
                                            const currentPeriodEnd = referrerStripeSub.current_period_end;
                                            const newPeriodEnd = new Date(currentPeriodEnd * 1000);
                                            newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
                                            const newTimestamp = Math.floor(newPeriodEnd.getTime() / 1000);

                                            await stripe.subscriptions.update(referrerSub.stripe_subscription_id, {
                                                trial_end: newTimestamp,
                                                proration_behavior: 'none',
                                            });
                                            console.log(`Extended referrer ${referrerId} billing to ${newPeriodEnd.toISOString()}`);
                                        } else {
                                            let couponIdToUse = COUPON_ID;
                                            try {
                                                await stripe.coupons.retrieve(COUPON_ID);
                                            } catch {
                                                const newCoupon = await stripe.coupons.create({
                                                    percent_off: 100,
                                                    duration: 'once',
                                                    name: 'Referral Reward: 1 Month Free',
                                                    max_redemptions: 2,
                                                    id: COUPON_ID
                                                });
                                                couponIdToUse = newCoupon.id;
                                            }

                                            await stripe.customers.update(referrerSub.stripe_customer_id, {
                                                coupon: couponIdToUse,
                                            });
                                            console.log(`Applied coupon to referrer ${referrerId}`);
                                        }

                                        // --- REFEREE LOGIC ---
                                        let refereeCouponId = COUPON_ID;
                                        try {
                                            await stripe.coupons.retrieve(COUPON_ID);
                                        } catch {
                                            const newCoupon = await stripe.coupons.create({
                                                percent_off: 100,
                                                duration: 'once',
                                                name: 'Referral Reward: 1 Month Free',
                                                id: COUPON_ID
                                            });
                                            refereeCouponId = newCoupon.id;
                                        }

                                        await stripe.customers.update(customerId, {
                                            coupon: refereeCouponId,
                                        });


                                        await supabaseAdmin.from('notifications').insert({
                                            user_id: referrerId,
                                            title: 'Referral Reward',
                                            message: "You've received 1 Month Free, 5 Dungeon Keys, and 5 Plan Credits.",
                                            type: 'success',
                                            action_link: '/settings'
                                        });
                                        await supabaseAdmin.from('notifications').insert({
                                            user_id: subRecord.user_id,
                                            title: 'Referral Reward',
                                            message: "You've received 1 Month Free",
                                            type: 'success',
                                            action_link: '/settings'
                                        });
                                    }
                                } catch (stripeErr) {
                                    console.error('Failed to apply referral rewards:', stripeErr);
                                }
                            }
                        }
                        await supabaseAdmin.from('notifications').insert({
                            user_id: subRecord.user_id,
                            title: status === 'trialing' ? 'Trial Started!' : 'Thank you for subscribing!',
                            message: status === 'trialing'
                                ? 'Welcome to Questr!'
                                : "You've received 5 Dungeon Keys. Have fun!",
                            type: 'success',
                            action_link: '/log'
                        });
                    }
                }
                break;
            }
        }

        if (event.type === 'invoice.paid') {
            const invoice = event.data.object as Stripe.Invoice;
            if (invoice.subscription && invoice.amount_paid > 0) {
                const customerId = invoice.customer as string;

                const { data: subRecord } = await supabaseAdmin
                    .from('subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (subRecord?.user_id) {
                    const { data: profile } = await supabaseAdmin
                        .from('profiles')
                        .select('guild_id')
                        .eq('id', subRecord.user_id)
                        .single();

                    if (profile?.guild_id) {
                        const { data: guild } = await supabaseAdmin
                            .from('guilds')
                            .select('master_id')
                            .eq('id', profile.guild_id)
                            .single();

                        if (guild?.master_id && guild.master_id !== subRecord.user_id) {
                            const revenueCents = Math.floor(invoice.amount_paid * 0.10);

                            if (revenueCents > 0) {
                                await supabaseAdmin
                                    .from('master_revenue_ledgers')
                                    .insert({
                                        user_id: guild.master_id,
                                        source_user_id: subRecord.user_id,
                                        amount_cents: revenueCents,
                                        currency: invoice.currency || 'usd',
                                        description: `10% rev share from invoice ${invoice.id}`
                                    });

                                await supabaseAdmin.from('notifications').insert({
                                    user_id: guild.master_id,
                                    title: 'Guild Revenue Received!',
                                    message: `A member's subscription added ${(revenueCents / 100).toFixed(2)} ${invoice.currency?.toUpperCase() || 'USD'} to your balance.`,
                                    type: 'success',
                                    action_link: '/guilds/revenue'
                                });
                            }
                        }
                    }
                }
            }
        }

        return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
    } catch (err: unknown) {
        const error = err as Error;
        console.error(`Webhook Error: ${error.message}`);
        return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }
});
