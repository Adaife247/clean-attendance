import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';
import { getClientIp } from '@/utils/rate-limit';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const sessionId = body.sessionId || body.session_id;
    const rawMatric = body.matricNumber || body.matric_number;

    if (!sessionId || !rawMatric) return NextResponse.json({ message: "Missing data" }, { status: 400 });

    const { data: session } = await supabase.from('lecture_sessions').select('course_id').eq('session_id', sessionId).maybeSingle();
    if (!session || !session.course_id) return NextResponse.json({ message: "Session not found" }, { status: 404 });

    const { data: course } = await supabase.from('courses').select('id').eq('id', session.course_id).eq('lecturer_id', auth.user.id).maybeSingle();
    if (!course) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const cleanMatric = String(rawMatric).toUpperCase().trim();

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (!enrollment) return NextResponse.json({ message: "Student is not enrolled in this course." }, { status: 403 });

    const overrideTimestamp = new Date().toISOString();

    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (existingLog) {
      await supabase.from('attendance_logs').update({
          status: 'verified',
          device_info: JSON.stringify({ method: "Manual Override - Updated" }),
          approved_by: auth.user.id,
          override_timestamp: overrideTimestamp,
        }).eq('id', existingLog.id);
    } else {
      await supabase.from('attendance_logs').insert([{
          session_id: sessionId,
          matric_number: cleanMatric,
          status: 'verified',
          device_info: JSON.stringify({ method: "Manual Override - Inserted" }),
          device_hash: 'manual-override',
          approved_by: auth.user.id,
          override_timestamp: overrideTimestamp,
        }]);
    }

    await supabase.from('checkin_attempts').insert({
      session_id: sessionId,
      matric_number: cleanMatric,
      outcome: 'verified',
      reason_code: 'MANUAL_OVERRIDE',
      reason_detail: { approved_by_lecturer: auth.user.id, timestamp: overrideTimestamp },
      ip_address: getClientIp(request)
    });

    return NextResponse.json({ message: "Success" });
  } catch {
    return NextResponse.json({ message: "Override failed" }, { status: 500 });
  }
}