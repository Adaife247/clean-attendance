import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

function sanitizeCSV(val: string | number) {
  const str = String(val);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export async function GET(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('courseCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!courseCode) return NextResponse.json({ error: "Missing course code" }, { status: 400 });

    const { data: courseData } = await supabase
      .from('courses')
      .select('id, total_planned_classes, max_attendance_score, is_finalized')
      .eq('course_code', courseCode)
      .eq('lecturer_id', auth.user.id)
      .single();

    if (!courseData) {
      return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 404 });
    }

    // 1. Get sessions in range
    let sessionQuery = supabase
      .from('lecture_sessions')
      .select('session_id')
      .eq('course_code', courseCode);

    if (startDate) sessionQuery = sessionQuery.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      sessionQuery = sessionQuery.lte('created_at', end.toISOString());
    }

    const { data: sessions } = await sessionQuery;
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: "No sessions recorded for this timeframe." }, { status: 404 });
    }

    const sessionIds = sessions.map(s => s.session_id);
    const totalClassesHeld = sessions.length;

    // 2. Get the roster (small — one row per student)
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('matric_number')
      .eq('course_id', courseData.id);
    const roster = enrollments?.map(e => e.matric_number) || [];

    // 3. NEW: Get pre-aggregated counts from the SQL view
    // Instead of fetching 40,000 log rows, we fetch at most 2,000 rows
    const { data: counts } = await supabase
      .from('session_attendance_counts')
      .select('matric_number, verified_count')
      .in('session_id', sessionIds);

    // 4. Sum per-student totals
    const attendanceMap = new Map<string, number>();
    roster.forEach(matric => attendanceMap.set(matric, 0));

    (counts || []).forEach(row => {
      if (!attendanceMap.has(row.matric_number)) attendanceMap.set(row.matric_number, 0);
      attendanceMap.set(row.matric_number, attendanceMap.get(row.matric_number)! + 1);
    });

    const report = Array.from(attendanceMap.entries()).map(([matric, attended]) => {
      const percentage = Math.round((attended / totalClassesHeld) * 100);
      return {
        matricNumber: sanitizeCSV(matric),
        totalClasses: totalClassesHeld,
        attended,
        percentage,
        eligible: percentage >= 70 ? 'YES' : 'NO'
      };
    });

    report.sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));

    return NextResponse.json({
      course: courseCode,
      totalClasses: totalClassesHeld,
      plannedClasses: courseData.total_planned_classes || 15,
      maxScore: courseData.max_attendance_score || 10,
      isFinalized: courseData.is_finalized || false,
      report
    });

  } catch {
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}