export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) return NextResponse.json({ error: 'No sessionId' }, { status: 400 });

    // 1. Get the session
    const { data: session } = await supabase.from('sessions').select('status, course_id').eq('id', sessionId).single();
    
    // 2. Direct, foolproof course lookup
    let courseName = "Unknown Course";
    if (session?.course_id) {
      const { data: course } = await supabase.from('courses').select('course_code').eq('id', session.course_id).single();
      if (course) courseName = course.course_code;
    }

    // 3. Get the ledger
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('session_id', sessionId).order('check_in_time', { ascending: false });

    return NextResponse.json({
      course: courseName,
      isActive: session?.status === 'active',
      logs: (logs || []).map((l: any) => ({
        id: l.id,
        matricNumber: l.matric_number,
        status: l.status,
        time: new Date(l.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}