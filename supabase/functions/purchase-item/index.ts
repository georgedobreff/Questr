import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { item_id, is_pet_item }: { item_id: number, is_pet_item: boolean } = await req.json();

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Use the admin client to call the trusted database function
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let data, rpcError;

    if (is_pet_item) {
      const result = await supabaseAdmin.rpc('purchase_pet_item', {
        p_user_id: user.id,
        p_pet_item_id: item_id,
      });
      // purchase_pet_item returns void, so data is null. 
      // We assume success if no error.
      data = "Purchase successful.";
      rpcError = result.error;
    } else {
      const result = await supabaseAdmin.rpc('purchase_item', {
        p_user_id: user.id,
        p_item_id: item_id,
      });
      data = result.data;
      rpcError = result.error;
    }

    if (rpcError) throw rpcError;

    // For regular items, the RPC returns a message. For pet items, we simulated it.
    if (data !== 'Purchase successful.') {
      return new Response(JSON.stringify({ message: data }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }





    // Check for achievements (kept from original)
    await supabaseAdmin.rpc('check_achievements', { user_id_input: user.id });

    return new Response(JSON.stringify({ message: data }), {

      status: 200,

      headers: { 'Content-Type': 'application/json', ...corsHeaders },

    });



  } catch (err: unknown) {

    const error = err as Error;

    return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {

      status: 500,

      headers: { 'Content-Type': 'application/json', ...corsHeaders },

    });

  }

});

