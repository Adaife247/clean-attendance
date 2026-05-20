import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { sessionId, matricNumber } = await request.json();

    if (!sessionId || !matricNumber) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const cleanMatric = matricNumber.trim().toUpperCase();

    // 1. Get or Create the Student Profile (Handles dead phones/new students)
    let { data: student } = await supabase
      .from('profiles')
      .select('student_id')
      .eq('matric_number', cleanMatric)
      .single();

    if (!student) {
      const { data: newStudent, error: insertError } = await supabase
        .from('profiles')
        .insert([{ matric_number: cleanMatric, full_name: "Manual Entry" }])
        .select('student_id')
        .single();
        
      if (insertError) throw new Error("Failed to create profile");
      student = newStudent;
    }

    // 2. UPSERT the Ledger (If they exist, update to verified. If not, insert them as verified)
    const { error: upsertError } = await supabase
      .from('attendance_logs')
      .upsert({ 
        session_id: sessionId,
        student_id: student.student_id,
        status: 'verified',
        telemetry_metadata: { note: "Manual override by lecturer" }
      }, { 
        onConflict: 'session_id,student_id' // Uses our unique constraint to prevent duplicates!
      });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return NextResponse.json({ status: 'success', message: `${cleanMatric} manually verified.` }, { status: 200 });

  } catch (error) {
    console.error("Override API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}