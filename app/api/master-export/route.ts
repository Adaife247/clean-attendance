import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

// Helper to sanitize CSV cells and prevent CSV Injection
function sanitizeCSV(val: string | number) {
  const str = String(val);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`; // Prepend single quote to neutralize formulas
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

    let query = supabase.from('lecture_sessions').select('session_id').eq('course_code', courseCode);
    if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }

    const { data: sessions } = await query;
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: "No sessions recorded for this timeframe." }, { status: 404 });
    }

    const sessionIds = sessions.map(s => s.session_id);
    const totalClassesHeld = sessions.length;

    const { data: enrollments } = await supabase.from('enrollments').select('matric_number').eq('course_id', courseData.id);
    const roster = enrollments?.map(e => e.matric_number) || [];

    const { data: logs } = await supabase.from('attendance_logs').select('matric_number, status').in('session_id', sessionIds).eq('status', 'verified');

    const attendanceMap = new Map<string, number>();
    roster.forEach((matric: string) => attendanceMap.set(matric, 0));

    (logs || []).forEach(log => {
      if (!attendanceMap.has(log.matric_number)) attendanceMap.set(log.matric_number, 0);
      attendanceMap.set(log.matric_number, attendanceMap.get(log.matric_number)! + 1);
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