import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const courseId = body.courseId;
    const matricNumber = body.matricNumber;

    // Check exactly what is missing
    if (!courseId || !matricNumber) {
      return NextResponse.json({ error: "Missing data. Make sure a course is selected and a matric number is entered." }, { status: 400 });
    }

    const cleanMatric = String(matricNumber).toUpperCase().trim();

    // 1. Verify course belongs to this lecturer using the unique courseId
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('lecturer_id', auth.user.id)
      .maybeSingle();

    if (!course) return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 403 });

    // 2. Verify the student is actually enrolled in this course
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (!enrollment) return NextResponse.json({ error: "Student is not enrolled in this course" }, { status: 403 });

    // 3. Set the new rep.
    const { error: upsertError } = await supabase
      .from('course_reps')
      .upsert({
        course_id: course.id,
        matric_number: cleanMatric,
      }, { 
        onConflict: 'course_id' 
      });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Set Rep Error:", error);
    return NextResponse.json({ error: "Failed to designate rep" }, { status: 500 });
  }
}