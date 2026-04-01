import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://questr.gg",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const deleteUserData = async (supabase: SupabaseClient, tableName: string, userId: string) => {
  console.log(`Attempting to delete from ${tableName} for user ${userId}`);
  const { data, error } = await supabase.from(tableName).delete().eq('user_id', userId);
  if (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    // Continue even if error, to try and clean up as much as possible
  }
  return data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const userId = user.id;

    // --- STRIPE CANCELLATION LOGIC ---
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
      });

      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', userId)
        .single();

      if (subscription?.stripe_subscription_id) {
        try {
          console.log(`Cancelling Stripe subscription: ${subscription.stripe_subscription_id}`);
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          console.log("Stripe subscription cancelled.");
        } catch (stripeError) {
          console.error("Error cancelling Stripe subscription:", stripeError);
          // We log it but proceed with deletion, otherwise user is stuck.
          // In production, this might trigger an alert to admin.
        }
      }
    }
    // ----------------------------------

    // ** DEBUGGING: Manually delete from each table **
    // Note: With ON DELETE CASCADE now verified in migrations, 
    // simply deleting the user via admin.deleteUser SHOULD cascade everything.
    // But manual deletion acts as a safeguard.

    await deleteUserData(supabaseAdmin, 'user_stats', userId);
    await deleteUserData(supabaseAdmin, 'chat_history', userId);
    await deleteUserData(supabaseAdmin, 'adventure_chat_history', userId);
    await deleteUserData(supabaseAdmin, 'equipped_items', userId);
    await deleteUserData(supabaseAdmin, 'user_items', userId);
    await deleteUserData(supabaseAdmin, 'plans', userId);
    await deleteUserData(supabaseAdmin, 'subscriptions', userId);
    await deleteUserData(supabaseAdmin, 'processed_webhook_events', userId); // New table

    // Profiles table uses 'id' column
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
    if (profileError) console.error(`Error deleting from profiles:`, profileError);

    // Finally, delete the auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error(`Error deleting auth user:`, authError);
      throw authError;
    }

    return new Response(JSON.stringify({ message: "Account deleted successfully." }), {

      status: 200,

      headers: { "Content-Type": "application/json", ...corsHeaders },

    });

  } catch (err: unknown) {

    const error = err as Error;

    console.error("Error during manual account deletion:", error.message);

    return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {

      status: 500,

      headers: { "Content-Type": "application/json", ...corsHeaders },

    });

  }

});

