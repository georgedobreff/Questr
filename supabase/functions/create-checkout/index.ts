import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { priceId: bodyPriceId, successUrl, cancelUrl, mode, productType }: { priceId?: string, successUrl: string, cancelUrl: string, mode?: 'payment' | 'subscription', productType?: string } = await req.json();

    if (!successUrl || !cancelUrl) {
      throw new Error("Missing successUrl or cancelUrl in request body");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id
        }
      });
      customerId = customer.id;

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'free'
        }, { onConflict: 'user_id' });
    }

    const proPriceId = Deno.env.get('PRO_SUBSCRIPTION_PRICE_ID');
    let finalPriceId = bodyPriceId;

    if (productType) {
      if (productType === 'dungeon_key') {
        finalPriceId = Deno.env.get('DUNGEON_KEY_PRICE_ID');
        if (!finalPriceId) throw new Error("DUNGEON_KEY_PRICE_ID not configured");
      } else if (productType === 'pet_energy_refill') {
        finalPriceId = Deno.env.get('ENERGY_REFILL_PRICE_ID');
        if (!finalPriceId) throw new Error("ENERGY_REFILL_PRICE_ID not configured");
      } else if (productType === 'plan_credit') {
        finalPriceId = Deno.env.get('PLAN_CREDIT_PRICE_ID');
        if (!finalPriceId) throw new Error("PLAN_CREDIT_PRICE_ID not configured");
      } else {
        throw new Error(`Unknown product type: ${productType}`);
      }
    } else if (!finalPriceId) {
      finalPriceId = proPriceId;
      if (!finalPriceId) throw new Error("PRO_SUBSCRIPTION_PRICE_ID not configured");
    }

    if (!finalPriceId) {
      throw new Error("No price ID determined for checkout");
    }

    let subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData | undefined = undefined;

    // Only apply trial logic if this is the Pro Subscription
    /* 
    if (finalPriceId === proPriceId && (!mode || mode === 'subscription')) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('has_had_trial')
        .eq('id', user.id)
        .single();

      if (!profile?.has_had_trial) {
        subscriptionData = {
          trial_period_days: 0, // Stripe requires at least 1 day. Commenting out to disable trial.
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel'
            }
          },
          metadata: {
            user_id: user.id
          }
        };
      }
    }
    */

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: mode || 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: subscriptionData,
      metadata: {
        user_id: user.id,
        price_id: finalPriceId
      },
      allow_promotion_codes: true,
    };

    if ((mode || 'subscription') === 'subscription') {
      sessionConfig.payment_method_collection = 'always';
    }

    console.log("Session Config:", JSON.stringify(sessionConfig));

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Checkout Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
