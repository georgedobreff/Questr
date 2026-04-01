import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  let next = requestUrl.searchParams.get("next") || "/dashboard";


  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) {
    next = '/dashboard';
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single();

      if (profile && !profile.onboarding_completed) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }


      let redirectPath = next;
      try {

        const nextUrl = new URL(redirectPath, requestUrl.origin);
        if (nextUrl.pathname === "/") {
          redirectPath = "/dashboard";
        }
      } catch {

        redirectPath = "/dashboard";
      }

      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }


  return NextResponse.redirect(new URL("/login?error=auth_code_error", request.url));
}
