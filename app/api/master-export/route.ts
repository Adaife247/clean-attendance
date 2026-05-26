import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseCode = searchParams.get('courseCode');
    
    // NEW: Capture the optional date filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!courseCode) return NextResponse.json({ error: "Missing course code" }, { status: 400 });

    // 1. Build the dynamic session query
    let sessionQuery = supabase
      .from('lecture_sessions')
      .select('session_id')
      .ilike('course_code', courseCode);

    // Apply date filters if they exist
    if (startDate) {
      sessionQuery = sessionQuery.gte('created_at', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      sessionQuery = sessionQuery.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    const { data: sessions, error: sessionError } = await sessionQuery;

    if (sessionError) throw sessionError;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: "No sessions recorded for this course in this timeframe." }, { status: 404 });
    }

    const sessionIds = sessions.map(s => s.session_id);
    const totalClasses = sessions.length;

    // 2. Get the official course roster
    const { data: courseData } = await supabase
      .from('courses')
      .select('roster')
      .ilike('course_code', courseCode)
      .single();

    const roster = courseData?.roster || [];

    // 3. Get all verified attendance logs
    const { data: logs, error: logError } = await supabase
      .from('attendance_logs')
      .select('matric_number, status')
      .in('session_id', sessionIds)
      .eq('status', 'verified'); 

    if (logError) throw logError;

    // 4. Calculate Attendance
    const attendanceMap = new Map<string, number>();

    roster.forEach((matric: string) => attendanceMap.set(matric, 0));

    (logs || []).forEach(log => {
      if (!attendanceMap.has(log.matric_number)) {
         attendanceMap.set(log.matric_number, 0);
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

    report.sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));

    return NextResponse.json({
        course: courseCode,
        totalClasses,
        report
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}