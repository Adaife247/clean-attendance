import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export const dynamic = 'force-dynamic';

function sanitizeCSV(val: string | number) {
  const str = String(val);
  if (/^[=+\-@]/.test(str)) return `'${str}`;
  return str;
}

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
       return NextResponse.json({ error: 'Unauthorized: You can only export your own department' }, { status: 403 });
    }

    // 1. Get all courses in the department
    const { data: courses } = await supabase
      .from('courses')
      .select('id, course_code')
      .eq('department', department);

    if (!courses || courses.length === 0) {
      return NextResponse.json({ error: "No courses found in this department." }, { status: 404 });
    }

    const courseIds = courses.map(c => c.id);

    // 2. Get all sessions for these courses
    const { data: sessions } = await supabase
      .from('lecture_sessions')
      .select('session_id, course_id')
      .in('course_id', courseIds);

    const sessionIds = sessions?.map(s => s.session_id) || [];

    // 3. Get all enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id, matric_number')
      .in('course_id', courseIds);

    // 4. Get all verified attendance logs
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('matric_number, session_id')
      .in('session_id', sessionIds)
      .eq('status', 'verified');

    // ─── CALCULATE STATS ───
    // Structure: Map<Matric, Map<CourseID, { attended: number, total: number }>>
    const studentStats = new Map<string, Map<string, { attended: number, total: number }>>();

    // Initialize totals per course
    const courseSessionCounts = new Map<string, number>();
    sessions?.forEach(s => {
      courseSessionCounts.set(s.course_id, (courseSessionCounts.get(s.course_id) || 0) + 1);
    });

    // Initialize enrollments
    enrollments?.forEach(e => {
      if (!studentStats.has(e.matric_number)) {
        studentStats.set(e.matric_number, new Map());
      }
      studentStats.get(e.matric_number)!.set(e.course_id, { attended: 0, total: courseSessionCounts.get(e.course_id) || 0 });
    });

    // Count attended
    const sessionToCourse = new Map<string, string>();
    sessions?.forEach(s => sessionToCourse.set(s.session_id, s.course_id));

    logs?.forEach(l => {
      const courseId = sessionToCourse.get(l.session_id);
      if (courseId && studentStats.has(l.matric_number)) {
        const courseMap = studentStats.get(l.matric_number)!;
        if (courseMap.has(courseId)) {
          courseMap.get(courseId)!.attended += 1;
        }
      }
    });

    // ─── GENERATE CSV ───
    const datePrinted = new Date().toLocaleDateString();
    const header = [
      [`DEPARTMENT-WIDE NUC COMPLIANCE REPORT`],
      [`Department:`, department],
      [`Date Generated:`, datePrinted],
      [`Total Courses:`, courses.length],
      [],
      ["MATRICULATION NUMBER", "COURSE CODE", "CLASSES HELD", "ATTENDED", "PERCENTAGE (%)", "NUC STATUS"]
    ];

    const rows: (string | number)[][] = [];
    const sortedMatrics = Array.from(studentStats.keys()).sort();

    sortedMatrics.forEach(matric => {
      const courseMap = studentStats.get(matric)!;
      // Sort courses alphabetically for this student
      const studentCourses = Array.from(courseMap.entries()).sort((a, b) => {
        const codeA = courses.find(c => c.id === a[0])?.course_code || '';
        const codeB = courses.find(c => c.id === b[0])?.course_code || '';
        return codeA.localeCompare(codeB);
      });

      studentCourses.forEach(([courseId, stats]) => {
        const courseCode = courses.find(c => c.id === courseId)?.course_code || 'Unknown';
        const percentage = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0;
        
        rows.push([
          sanitizeCSV(matric),
          sanitizeCSV(courseCode),
          stats.total,
          stats.attended,
          percentage,
          percentage >= 70 ? "CLEARED" : "AT RISK"
        ]);
      });
    });

    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Return as a file download
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="Department_${department}_Compliance.csv"`
      }
    });

  } catch (error) {
    console.error("HOD Export Error:", error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}