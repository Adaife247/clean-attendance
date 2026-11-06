import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';
import { verifyStudentToken } from '@/utils/student-auth';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const { data: session } = await supabase
      .from('lecture_sessions')
      .select('course_id, started_by')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    let authorized = false;

    // 1. Is it the Lecturer?
    const lecturerAuth = await verifyLecturer(request);
    if (!lecturerAuth.error) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', session.course_id)
        .eq('lecturer_id', lecturerAuth.user.id)
        .maybeSingle();
      if (course) authorized = true;
    } 
    
    // 2. Is it the Class Rep who started it?
    if (!authorized && session.started_by === 'Class Rep') {
      const studentAuth = verifyStudentToken(request);
      if (!studentAuth.error) {
        const { data: rep } = await supabase
          .from('course_reps')
          .select('id')
          .eq('course_id', session.course_id)
          .eq('matric_number', studentAuth.matric)
          .maybeSingle();
        if (rep) authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized to end this session' }, { status: 403 });
    }

    await supabase.from('lecture_sessions').update({ is_active: false }).eq('session_id', sessionId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
  }
}