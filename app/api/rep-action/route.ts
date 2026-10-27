import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { RATE_LIMIT_DEFAULTS } from '@/utils/constants';

export async function POST(request: Request) {
  try {
    // NEW: Rate limiting (10 attempts/min per IP)
    const ip = getClientIp(request);
    const limit = RATE_LIMIT_DEFAULTS['rep-action'];
    const rateCheck = checkRateLimit(`rep-action:${ip}`, limit);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute." },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const body = await request.json();
    const { action, sessionId, matricNumber, repMatric } = body;

    if (!sessionId || !repMatric) {
      return NextResponse.json({ error: "Missing session or rep" }, { status: 400 });
    }

    // 1. Verify the requester is actually a Class Rep
    const { data: repProfile } = await supabase
      .from('student_profiles')
      .select('is_class_rep')
      .eq('matric_number', repMatric)
      .single();

    if (!repProfile?.is_class_rep) {
      return NextResponse.json({ error: "Unauthorized. Only Class Reps can do this." }, { status: 403 });
    }

    // 2. Get the session's EXACT course
    const { data: session } = await supabase
      .from('lecture_sessions')
      .select('course_code, created_at')
      .eq('session_id', sessionId)
      .single();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const { data: course } = await supabase
      .from('courses')
      .select('id, created_at')
      .eq('course_code', session.course_code)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    // 3. Rep must be enrolled in the EXACT course row
    const { data: repEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('matric_number', repMatric)
      .maybeSingle();

    if (!repEnrollment) {
      return NextResponse.json({ error: "Unauthorized. Rep must be enrolled in this course." }, { status: 403 });
    }

    if (action === 'log_dead_battery') {
      if (!matricNumber) {
        return NextResponse.json({ error: "Missing matric" }, { status: 400 });
      }

      const cleanMatric = matricNumber.toUpperCase().trim();

      // 4. Target must be enrolled in the same course
      const { data: targetEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', course.id)
        .eq('matric_number', cleanMatric)
        .maybeSingle();

      if (!targetEnrollment) {
        return NextResponse.json({ error: "This student is not enrolled in this course." }, { status: 403 });
      }

      // 5. Check the 3-student cap
      const { count } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('device_hash', 'rep-battery-log');

      if (count !== null && count >= 3) {
        return NextResponse.json({ error: "Limit reached. Only 3 students can claim battery dead per class." }, { status: 403 });
      }

      // 6. Check for existing log
      const { data: existingLog } = await supabase
        .from('attendance_logs')
        .select('id, status')
        .eq('session_id', sessionId)
        .eq('matric_number', cleanMatric)
        .maybeSingle();

      if (existingLog) {
        if (existingLog.status === 'verified') {
          return NextResponse.json({ error: "Student is already verified." }, { status: 409 });
        }
        await supabase.from('attendance_logs').update({
          status: 'pending_override',
          device_info: JSON.stringify({ method: "Class Rep - Battery Dead" }),
          device_hash: 'rep-battery-log'
        }).eq('id', existingLog.id);
      } else {
        await supabase.from('attendance_logs').insert([{
          session_id: sessionId,
          matric_number: cleanMatric,
          status: 'pending_override',
          device_info: JSON.stringify({ method: "Class Rep - Battery Dead" }),
          device_hash: 'rep-battery-log'
        }]);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}