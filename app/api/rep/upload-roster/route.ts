// app/api/rep/upload-roster/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyStudentToken } from '@/utils/student-auth';

export async function POST(request: Request) {
  try {
    const auth = verifyStudentToken(request);
    if (auth.error) return auth.error;
    const repMatric = auth.matric!;

    const body = await request.json();
    const { courseId, matrics } = body;

    if (!courseId || !matrics || !Array.isArray(matrics)) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Verify the student is actually the Class Rep for this course
    const { data: rep } = await supabase
      .from('course_reps')
      .select('id')
      .eq('course_id', courseId)
      .eq('matric_number', repMatric)
      .maybeSingle();

    if (!rep) {
      return NextResponse.json({ error: "Unauthorized: You are not the rep for this course." }, { status: 403 });
    }

    // 2. Upload the roster
    const rows = matrics.map((matric: string) => ({
      course_id: courseId,
      matric_number: matric.toUpperCase().trim(),
    }));

    const { error } = await supabase
      .from('enrollments')
      .upsert(rows, { onConflict: 'course_id,matric_number', ignoreDuplicates: true });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rep Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload roster" }, { status: 500 });
  }
}