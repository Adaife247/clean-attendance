import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const sessionId = body.sessionId || body.session_id || body.session;
    const rawMatric = body.matricNumber || body.matric_number || body.matric;

    if (!sessionId || !rawMatric) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    // Verify ownership
    const { data: session } = await supabase.from('lecture_sessions').select('course_code').eq('session_id', sessionId).single();
    if (!session) return NextResponse.json({ message: "Session not found" }, { status: 404 });

    const { data: course } = await supabase.from('courses').select('id').eq('course_code', session.course_code).eq('lecturer_id', auth.user.id).single();
    if (!course) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const cleanMatric = String(rawMatric).toUpperCase().trim();
    const overrideTimestamp = new Date().toISOString();

    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog) {
      await supabase
        .from('attendance_logs')
        .update({
          status: 'verified',
          device_info: JSON.stringify({ method: "Manual Override - Updated" }),
          approved_by: auth.user.id,
          override_timestamp: overrideTimestamp,
        })
        .eq('id', existingLog.id);
    } else {
      await supabase
        .from('attendance_logs')
        .insert([{
          session_id: sessionId,
          matric_number: cleanMatric,
          status: 'verified',
          device_info: JSON.stringify({ method: "Manual Override - Inserted" }),
          device_hash: 'manual-override',
          approved_by: auth.user.id,
          override_timestamp: overrideTimestamp,
        }]);
    }

    return NextResponse.json({ message: "Success" });
  } catch (error) {
    return NextResponse.json({ message: "Override failed" }, { status: 500 });
  }
}