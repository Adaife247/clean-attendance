import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const courseCodeToSave = body.courseCode || body.course_code;
    
    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code." }, { status: 400 });
    }

    // Verify ownership of the course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('course_code', courseCodeToSave)
      .eq('lecturer_id', auth.user.id)
      .single();

    if (!course) return NextResponse.json({ error: 'Unauthorized for this course' }, { status: 403 });

    const parsedDuration = parseInt(body.duration);
    const durationMinutes = Number.isFinite(parsedDuration) ? Math.min(Math.max(parsedDuration, 5), 120) : 60;
    const parsedWait = parseInt(body.checkinOpensAfter);
    const checkinOpensAfterMinutes = Number.isFinite(parsedWait) ? Math.min(Math.max(parsedWait, 0), 60) : 10;

    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([{
        course_code: courseCodeToSave,
        anchor_latitude: body.latitude || body.lat,
        anchor_longitude: body.longitude || body.lng,
        is_active: true,
        expires_at: expiresAt,
        checkin_opens_after_minutes: checkinOpensAfterMinutes,
        started_by: auth.user.id
      }])
      .select('session_id')
      .single();

    if (error) throw error;

    return NextResponse.json({
      sessionId: data.session_id,
      expiresAt,
      checkinOpensAfterMinutes
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}