export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

interface AttendanceLogRow {
  id: string;
  matric_number: string;
  status: string;
  check_in_time: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) return NextResponse.json({ error: 'No sessionId' }, { status: 400 });

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('is_active, course_code, created_at')
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
      createdAt: session?.created_at || null,
      logs: (logs as AttendanceLogRow[] | null || []).map((l) => ({
        id: l.id,
        matricNumber: l.matric_number,
        status: l.status,
        time: new Date(l.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}