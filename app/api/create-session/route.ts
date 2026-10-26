import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseCodeToSave = body.courseCode || body.course_code;
    const startedBy = body.startedBy || 'lecturer';

    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code." }, { status: 400 });
    }

    // 1. Sanitize Duration (Max 2 hours, Min 5 mins)
    const parsedDuration = parseInt(body.duration);
    const durationMinutes = Number.isFinite(parsedDuration) 
      ? Math.min(Math.max(parsedDuration, 5), 120) 
      : 60;

    // 2. Sanitize Check-in Wait Time (Max 60 mins, Min 0)
    const parsedWait = parseInt(body.checkinOpensAfter);
    const checkinOpensAfterMinutes = Number.isFinite(parsedWait)
      ? Math.min(Math.max(parsedWait, 0), 60)
      : 10;

    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    // 3. Insert using the admin client (bypasses RLS, but we've validated inputs)
    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([{
        course_code: courseCodeToSave,
        anchor_latitude: body.latitude || body.lat,
        anchor_longitude: body.longitude || body.lng,
        is_active: true,
        expires_at: expiresAt,
        checkin_opens_after_minutes: checkinOpensAfterMinutes,
        started_by: startedBy
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