import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Function to send email via Resend
async function sendEmail({ type, message, url, userEmail, userName }: { type: string, message: string, url: string, userEmail: string, userName: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Questr Feedback <support@questr.gg>",
      to: ["support@questr.gg"],
      reply_to: userEmail,
      subject: `[${type.toUpperCase()}] New Feedback from ${userName}`,
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>User:</strong> ${userName} (<a href="mailto:${userEmail}">${userEmail}</a>)</p>
        <p><strong>Page:</strong> ${url}</p>
        <hr />
        <h3>Message:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API Error: ${error}`);
  }

  return await res.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { message, type, url, name }: { message: string, type: string, url?: string, name?: string } = await req.json();

    if (!message || !type) {
      throw new Error("Message and Type are required.");
    }

    await sendEmail({
      type,
      message,
      url: url || "Unknown",
      userEmail: user.email!,
      userName: name || user.email!.split("@")[0] || "Adventurer",
    });

    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Feedback Received",
      message: "Thank you for your feedback! The spirits are reviewing your message.",
      type: "info"
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Feedback Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
