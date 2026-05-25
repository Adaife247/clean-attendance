import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const { sessionId, passcode } = await request.json();

    if (!sessionId || !passcode) {
      return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
    }

    const { data: session } = await supabase
      .from('lecture_sessions')
      .select('rep_passcode')
      .eq('session_id', sessionId)
      .single();

    if (session && session.rep_passcode === passcode) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ message: "Invalid passcode" }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}