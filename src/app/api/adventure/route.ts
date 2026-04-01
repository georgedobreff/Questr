import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: { action?: string; message?: string } = await req.json();


    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/adventure-dm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(body),
            });


            if (response.ok || response.status < 500) {
                break;
            }
        } catch (e) {
            console.error(`Attempt ${attempts} failed:`, e);
        }


        if (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (!response) {
        return NextResponse.json({ error: 'Failed to connect to Adventure Service after multiple attempts.' }, { status: 504 });
    }

    const responseText = await response.text().catch(() => '');
    
    interface AdventureResponseData {
        error?: string;
        [key: string]: string | number | boolean | object | undefined;
    }

    let responseData: AdventureResponseData;
    
    try {
        responseData = JSON.parse(responseText) as AdventureResponseData;
    } catch (e) {

        const errorMessage = responseText.includes('<') ? 'Service Timeout or Gateway Error' : (responseText || response.statusText);
        return NextResponse.json({ 
            error: `Service Error: ${errorMessage}`,
            raw: responseText.substring(0, 100) 
        }, { status: response.status || 500 });
    }

    if (!response.ok) {
        return NextResponse.json({ error: responseData.error || 'An unknown error occurred.' }, { status: response.status });
    }
    
    return NextResponse.json(responseData);

  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}