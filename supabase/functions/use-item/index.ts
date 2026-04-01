import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_item_id }: { user_item_id: number } = await req.json();

    if (!user_item_id) {
      throw new Error('Missing user_item_id in request body.');
    }

    // Create a Supabase client with the user's auth context
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify user is authenticated
    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Call the secure, atomic SQL function
    const { data, error } = await userSupabaseClient
      .rpc('use_consumable_item', { p_user_item_id: user_item_id })
      .single();

    if (error) {
      throw new Error(`Failed to use item: ${error.message}`);
    }

    // Return success
    return new Response(JSON.stringify({ message: `Successfully used item: ${data}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Error in use-item function: ${error.message}`);
    return new Response(JSON.stringify({ error: "Something went wrong. Try again." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
