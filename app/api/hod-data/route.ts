import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    if (!department) {
      return NextResponse.json({ error: 'Missing department' }, { status: 400 });
    }

    if (auth.user.department !== department) {
       return NextResponse.json({ error: 'Unauthorized: You can only view your own department' }, { status: 403 });
    }

    // 1. Get all lecturers in the department
    const { data: lecturers } = await supabase
      .from('lecturers')
      .select('id, full_name, department')
      .eq('department', department);

    if (!lecturers || lecturers.length === 0) {
      return NextResponse.json({ lecturers: [], compliance: { total: 0, cleared: 0, atRisk: 0 } });
    }

    const lecturerIds = lecturers.map(l => l.id);

    // 2. Get ALL courses for these lecturers in one query
    const { data: allCourses } = await supabase
      .from('courses')
      .select('id, course_code, lecturer_id')
      .in('lecturer_id', lecturerIds);

    const courseIds = allCourses?.map(c => c.id) || [];
    const courseCodes = allCourses?.map(c => c.course_code) || [];

    // 3. Get ALL sessions for these courses in one query
    const { data: allSessions } = await supabase
      .from('lecture_sessions')
      .select('session_id, course_code')
      .in('course_code', courseCodes);

    const sessionIds = allSessions?.map(s => s.session_id) || [];

    // 4. Get ALL ratings for these sessions in one query
    const { data: allRatings } = await supabase
      .from('session_ratings')
      .select('session_id, rating')
      .in('session_id', sessionIds);

    // 5. Get ALL enrollments and attendance logs in one query
    const { data: allEnrollments } = await supabase
      .from('enrollments')
      .select('course_id, matric_number')
      .in('course_id', courseIds);

    const { data: allLogs } = await supabase
      .from('attendance_logs')
      .select('matric_number, session_id')
      .in('session_id', sessionIds)
      .eq('status', 'verified');

    // ─── NOW WE CALCULATE EVERYTHING IN MEMORY (SUPER FAST) ───

    let totalStudents = 0;
    let clearedStudents = 0;
    let atRiskStudents = 0;

    const lecturerStats = lecturers.map(lec => {
      // Filter courses for this lecturer
      const lecCourses = allCourses?.filter(c => c.lecturer_id === lec.id) || [];
      const lecCourseCodes = lecCourses.map(c => c.course_code);
      
      // Filter sessions for this lecturer's courses
      const lecSessions = allSessions?.filter(s => lecCourseCodes.includes(s.course_code)) || [];
      const lecSessionIds = lecSessions.map(s => s.session_id);
      const lecTotalSessions = lecSessions.length;

      // Calculate ratings
      let avgRating = 0;
      let totalRatings = 0;
      const lecRatings = allRatings?.filter(r => lecSessionIds.includes(r.session_id)) || [];
      
      if (lecRatings.length > 0) {
        totalRatings = lecRatings.length;
        const sum = lecRatings.reduce((acc, r) => acc + r.rating, 0);
        avgRating = Number((sum / totalRatings).toFixed(1));
      }

      // Calculate NUC compliance for this lecturer's courses
      const lecCourseIds = lecCourses.map(c => c.id);
      const lecEnrollments = allEnrollments?.filter(e => lecCourseIds.includes(e.course_id)) || [];
      const uniqueMatrics = Array.from(new Set(lecEnrollments.map(e => e.matric_number)));

      if (lecTotalSessions > 0 && uniqueMatrics.length > 0) {
        const lecLogs = allLogs?.filter(l => lecSessionIds.includes(l.session_id)) || [];
        
        const attendanceCounts: Record<string, number> = {};
        lecLogs.forEach(log => {
          attendanceCounts[log.matric_number] = (attendanceCounts[log.matric_number] || 0) + 1;
        });

        for (const matric of uniqueMatrics) {
          const attended = attendanceCounts[matric] || 0;
          const percentage = (attended / lecTotalSessions) * 100;
          totalStudents++;
          if (percentage >= 70) clearedStudents++;
          else atRiskStudents++;
        }
      }

      return {
        id: lec.id,
        full_name: lec.full_name,
        department: lec.department,
        course_count: lecCourses.length,
        session_count: lecTotalSessions,
        avg_rating: avgRating,
        total_ratings: totalRatings,
      };
    });

    return NextResponse.json({
      lecturers: lecturerStats,
      compliance: { total: totalStudents, cleared: clearedStudents, atRisk: atRiskStudents }
    });

  } catch (error) {
    console.error("HOD API Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}