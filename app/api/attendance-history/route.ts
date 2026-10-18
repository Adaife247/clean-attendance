import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseCode = searchParams.get('courseCode');

  if (!courseCode) return NextResponse.json({ message: "Missing course code" }, { status: 400 });

  // 1. Get all past sessions for this course
  const { data: sessions, error } = await supabase
    .from('lecture_sessions')
    .select('session_id, created_at, course_code')
    .eq('course_code', courseCode)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: "Database error" }, { status: 500 });
  if (!sessions || sessions.length === 0) return NextResponse.json([]);

  const sessionIds = sessions.map(s => s.session_id);

  // 2. Get all attendance logs for these sessions to count them
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('session_id, status')
    .in('session_id', sessionIds);

  // 3. Calculate counts per session
  const historyData = sessions.map(session => {
    const sessionLogs = logs?.filter(l => l.session_id === session.session_id) || [];
    const verified = sessionLogs.filter(l => l.status === 'verified').length;
    const flagged = sessionLogs.filter(l => l.status === 'flagged' || l.status === 'pending_override').length;

    return {
      ...session,
      total_checkins: sessionLogs.length,
      verified_count: verified,
      flagged_count: flagged
    };
  });

  return NextResponse.json(historyData);
}