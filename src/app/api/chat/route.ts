import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }


    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();


    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/oracle-chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const responseData = await response.json();
        return new NextResponse(JSON.stringify({ error: responseData.error || 'An unknown error occurred.' }), { status: response.status });
    }
    
    return new NextResponse(response.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });

  } catch (err: unknown) {
    const error = err as Error;
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
