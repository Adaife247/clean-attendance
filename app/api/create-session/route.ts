import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';
import { headers } from 'next/headers';

// This MUST be exactly here. Below imports, above functions.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseCodeToSave = body.courseCode || body.course_code;
    const isRepStarting = body.startedBy === 'Class Rep';
    
    // Get IP address safely
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const lecturerIp = forwarded ? forwarded.split(',')[0].trim() : (headersList.get('x-real-ip') || 'unknown-ip');

    let authUserId = null;
    let finalStartedBy = 'lecturer';

    if (isRepStarting) {
      const { data: rep } = await supabase
        .from('student_profiles')
        .select('is_class_rep')
        .eq('matric_number', body.repMatric)
        .single();

      if (!rep?.is_class_rep) {
        return NextResponse.json({ error: 'Unauthorized: Not a valid Class Rep' }, { status: 403 });
      }
      finalStartedBy = 'Class Rep';
    } else {
      const auth = await verifyLecturer(request);
      if (auth.error) return auth.error;
      authUserId = auth.user.id;
    }

    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code." }, { status: 400 });
    }

    if (!isRepStarting) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('course_code', courseCodeToSave)
        .eq('lecturer_id', authUserId)
        .single();

      if (!course) return NextResponse.json({ error: 'Unauthorized for this course' }, { status: 403 });
    }

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
        anchor_ip: lecturerIp, 
        is_active: true,
        expires_at: expiresAt,
        checkin_opens_after_minutes: checkinOpensAfterMinutes,
        started_by: finalStartedBy
      }])
      .select('session_id')
      .single();

    if (error) {
      console.error("DATABASE REJECTED SESSION:", error);
      return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: data.session_id,
      expiresAt,
      checkinOpensAfterMinutes
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("CREATE SESSION FATAL ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}