import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) return NextResponse.json({ message: "Missing course ID" }, { status: 400 });

    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('lecturer_id', auth.user.id)
      .maybeSingle();

    if (!course) return NextResponse.json({ message: "Course not found or unauthorized" }, { status: 403 });

    const { data: sessions, error } = await supabase
      .from('lecture_sessions')
      .select('session_id, created_at, course_code')
      .eq('course_id', course.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ message: "Database error" }, { status: 500 });
    if (!sessions || sessions.length === 0) return NextResponse.json([]);

    const sessionIds = sessions.map(s => s.session_id);

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('session_id, status')
      .in('session_id', sessionIds);

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
  } catch {
    return NextResponse.json({ message: "Failed to load history" }, { status: 500 });
  }
}