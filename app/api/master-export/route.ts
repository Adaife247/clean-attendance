import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('courseCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!courseCode) return NextResponse.json({ error: "Missing course code" }, { status: 400 });

    // 1. Get Course Details
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('id, total_planned_classes, max_attendance_score, is_finalized')
      .eq('course_code', courseCode)
      .single();

    if (courseError || !courseData) {
       return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2. Build the query for sessions
    let query = supabase
      .from('lecture_sessions')
      .select('session_id')
      .eq('course_code', courseCode);

    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }

    const { data: sessions, error: sessionError } = await query;

    if (sessionError) throw sessionError;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: "No sessions recorded for this timeframe." }, { status: 404 });
    }

    const sessionIds = sessions.map(s => s.session_id);
    const totalClassesHeld = sessions.length;

    // 3. Get Enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('matric_number')
      .eq('course_id', courseData.id);

    const roster = enrollments?.map(e => e.matric_number) || [];

    // 4. Get Verified Logs
    const { data: logs, error: logError } = await supabase
      .from('attendance_logs')
      .select('matric_number, status')
      .in('session_id', sessionIds)
      .eq('status', 'verified');

    if (logError) throw logError;

    const attendanceMap = new Map<string, number>();
    roster.forEach((matric: string) => attendanceMap.set(matric, 0));

    (logs || []).forEach(log => {
      if (!attendanceMap.has(log.matric_number)) {
         attendanceMap.set(log.matric_number, 0);
      }
      attendanceMap.set(log.matric_number, attendanceMap.get(log.matric_number)! + 1);
    });

    // 5. Format the report
    const report = Array.from(attendanceMap.entries()).map(([matric, attended]) => {
      const percentage = Math.round((attended / totalClassesHeld) * 100);
      return {
        matricNumber: matric,
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

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}