import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');

    if (!department) {
      return NextResponse.json({ error: 'Missing department' }, { status: 400 });
    }

    // 1. Get all lecturers in this department
    const { data: lecturers } = await supabase
      .from('lecturers')
      .select('id, full_name, department')
      .eq('department', department);

    if (!lecturers || lecturers.length === 0) {
      return NextResponse.json({ lecturers: [], compliance: { total: 0, cleared: 0, atRisk: 0 } });
    }

    const lecturerStats = [];
    let totalStudents = 0;
    let clearedStudents = 0;
    let atRiskStudents = 0;

    for (const lec of lecturers) {
      // 2. Get Courses for this lecturer
      const { data: courses } = await supabase
        .from('courses')
        .select('id, course_code')
        .eq('lecturer_id', lec.id);
      
      const courseIds = courses?.map(c => c.id) || [];
      const courseCodes = courses?.map(c => c.course_code) || [];

      // 3. Get Sessions for these courses
      const { data: sessions } = await supabase
        .from('lecture_sessions')
        .select('session_id')
        .in('course_code', courseCodes);

      const sessionIds = sessions?.map(s => s.session_id) || [];
      const totalSessions = sessionIds.length;

      // 4. Get Ratings
      let avgRating = 0;
      let totalRatings = 0;
      if (sessionIds.length > 0) {
        const { data: ratings } = await supabase
          .from('session_ratings')
          .select('rating')
          .in('session_id', sessionIds);
        
        if (ratings && ratings.length > 0) {
          totalRatings = ratings.length;
          const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
          avgRating = Number((sum / totalRatings).toFixed(1));
        }
      }

      // 5. NUC Compliance using ENROLLMENTS table
      if (totalSessions > 0 && courseIds.length > 0) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('matric_number')
          .in('course_id', courseIds);

        if (enrollments && enrollments.length > 0) {
          const uniqueMatrics = Array.from(new Set(enrollments.map(e => e.matric_number)));
          
          for (const matric of uniqueMatrics) {
            const { count } = await supabase
              .from('attendance_logs')
              .select('*', { count: 'exact', head: true })
              .eq('matric_number', matric)
              .in('session_id', sessionIds)
              .eq('status', 'verified');

            const attended = count || 0;
            const percentage = (attended / totalSessions) * 100;

            totalStudents++;
            if (percentage >= 70) clearedStudents++;
            else atRiskStudents++;
          }
        }
      }

      lecturerStats.push({
        id: lec.id,
        full_name: lec.full_name,
        department: lec.department,
        course_count: courses?.length || 0,
        session_count: totalSessions,
        avg_rating: avgRating,
        total_ratings: totalRatings,
      });
    }

    return NextResponse.json({
      lecturers: lecturerStats,
      compliance: {
        total: totalStudents,
        cleared: clearedStudents,
        atRisk: atRiskStudents
      }
    });

  } catch (error) {
    console.error("HOD API Error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}