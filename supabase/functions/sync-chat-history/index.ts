import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface SyncRequest {
  content: string;
}

interface ChatMessage {
  id: number;
  content: string;
  user_id: string;
  role: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: SyncRequest = await req.json();
    const clientContent = body.content;

    if (typeof clientContent !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (clientContent.length > 10000) {
      return new Response(JSON.stringify({ error: 'Content too large' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: latestMsg, error: fetchError } = await supabaseAdmin
      .from('chat_history')
      .select('id, content, user_id, role')
      .eq('user_id', user.id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !latestMsg) {
      return new Response(JSON.stringify({ error: 'No active assistant message found to sync.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serverContent = (latestMsg as ChatMessage).content;

    const isCancelled = clientContent.startsWith("Response cancelled") || clientContent.endsWith("Response cancelled");

    if (isCancelled) {
      const { error: updateError } = await supabaseAdmin
        .from('chat_history')
        .update({ content: clientContent })
        .eq('id', latestMsg.id);

      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ success: true, action: 'cancelled_marked' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPlaceholder = serverContent === "";
    const isPrefixMatch = clientContent !== "" && serverContent.startsWith(clientContent);

    if (isPlaceholder || isPrefixMatch) {
      const { error: updateError } = await supabaseAdmin
        .from('chat_history')
        .update({ content: clientContent })
        .eq('id', latestMsg.id);

      if (updateError) {
        throw new Error(`Truncate failed: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ success: true, action: 'truncated' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const { error: deleteError = null } = await supabaseAdmin
        .from('chat_history')
        .delete()
        .eq('id', latestMsg.id);

      if (deleteError) {
        throw new Error(`Delete failed: ${deleteError.message}`);
      }

      return new Response(JSON.stringify({ success: true, action: 'discarded' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Sync error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
