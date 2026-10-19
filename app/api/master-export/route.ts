import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('courseCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!courseCode) return NextResponse.json({ error: "Missing course code" }, { status: 400 });

    // 1. Build the base query for sessions
    let query = supabase
      .from('lecture_sessions')
      .select('session_id')
      .eq('course_code', courseCode);

    // Apply Date Filters if they exist
    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }
    if (endDate) {
      // Set to the very end of the selected day (23:59:59)
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
    const totalClasses = sessions.length;

    // 2. Get the official course roster (from enrollments table)
    const { data: courseData } = await supabase
      .from('courses')
      .select('id')
      .eq('course_code', courseCode)
      .single();

    if (!courseData) {
       return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('matric_number')
      .eq('course_id', courseData.id);

    const roster = enrollments?.map(e => e.matric_number) || [];

    // 3. Get all verified attendance logs for the specific sessions
    const { data: logs, error: logError } = await supabase
      .from('attendance_logs')
      .select('matric_number, status')
      .in('session_id', sessionIds)
      .eq('status', 'verified');

    if (logError) throw logError;

    // 4. Calculate Attendance
    const attendanceMap = new Map<string, number>();

    // Start by assuming everyone on the roster has 0 attendance
    roster.forEach((matric: string) => attendanceMap.set(matric, 0));

    // Loop through logs and increment scores
    (logs || []).forEach(log => {
      if (!attendanceMap.has(log.matric_number)) {
         attendanceMap.set(log.matric_number, 0); // Catch students not on roster
      }
      attendanceMap.set(log.matric_number, attendanceMap.get(log.matric_number)! + 1);
    });

    // 5. Format the data for the CSV download
    const report = Array.from(attendanceMap.entries()).map(([matric, attended]) => {
      const percentage = Math.round((attended / totalClasses) * 100);
      return {
        matricNumber: matric,
        totalClasses,
        attended,
        percentage,
        eligible: percentage >= 70 ? 'YES' : 'NO'
      };
    });

    // Sort alphabetically by Matric Number
    report.sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));

    return NextResponse.json({
        course: courseCode,
        totalClasses,
        report
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}