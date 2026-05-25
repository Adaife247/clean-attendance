export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) return NextResponse.json({ error: 'No sessionId' }, { status: 400 });

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('is_active, course_code, rep_passcode')
      .eq('session_id', sessionId)
      .single();
    
    if (sessionError) console.error("Session Error:", sessionError.message);

    const courseName = session?.course_code || "Unknown Course";

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('check_in_time', { ascending: false });

    return NextResponse.json({
      course: courseName,
      isActive: session?.is_active === true,
      repPasscode: session?.rep_passcode || 'N/A', // Send passcode to frontend
      logs: (logs || []).map((l: any) => ({
        id: l.id,
        matricNumber: l.matric_number,
        status: l.status,
        time: new Date(l.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}