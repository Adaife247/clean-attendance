import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { sessionId } = await request.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    // Verify ownership
    const { data: session } = await supabase
      .from('lecture_sessions')
      .select('course_code')
      .eq('session_id', sessionId)
      .single();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('course_code', session.course_code)
      .eq('lecturer_id', auth.user.id)
      .single();

    if (!course) return NextResponse.json({ error: 'Unauthorized to end this session' }, { status: 403 });

    const { error } = await supabase
      .from('lecture_sessions')
      .update({ is_active: false })
      .eq('session_id', sessionId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
  }
}