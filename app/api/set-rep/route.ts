import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { courseCode, matricNumber } = await request.json();
    if (!courseCode || !matricNumber) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const cleanMatric = String(matricNumber).toUpperCase().trim();

    // 1. Verify course belongs to this lecturer
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('course_code', courseCode)
      .eq('lecturer_id', auth.user.id)
      .single();

    if (!course) return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 403 });

    // 2. Verify the student is actually enrolled in this course
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', course.id)
      .eq('matric_number', cleanMatric)
      .single();

    if (!enrollment) return NextResponse.json({ error: "Student is not enrolled in this course" }, { status: 403 });

    // 3. Unset any previous rep for this course (by checking all enrolled students)
    const { data: enrolledStudents } = await supabase.from('enrollments').select('matric_number').eq('course_id', course.id);
    if (enrolledStudents) {
      const allMatrics = enrolledStudents.map(e => e.matric_number);
      // Update the ones who currently have is_class_rep = true to false
      await supabase
        .from('student_profiles')
        .update({ is_class_rep: false })
        .in('matric_number', allMatrics)
        .eq('is_class_rep', true);
    }

    // 4. Set the new rep
    // FIX (B2 §5): Use update() instead of upsert() to prevent wiping their nickname, department, level, etc.
    // First, check if the profile exists.
    const { data: existingProfile } = await supabase
      .from('student_profiles')
      .select('matric_number')
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (existingProfile) {
      // Profile exists, just update the flag
      const { error: updateError } = await supabase
        .from('student_profiles')
        .update({ is_class_rep: true })
        .eq('matric_number', cleanMatric);
      
      if (updateError) throw updateError;
    } else {
      // Profile doesn't exist yet, create a minimal one
      const { error: insertError } = await supabase
        .from('student_profiles')
        .insert({ matric_number: cleanMatric, is_class_rep: true });
        
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json({ error: "Failed to designate rep" }, { status: 500 });
  }
}