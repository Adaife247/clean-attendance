import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, sessionId, matricNumber, repMatric } = body;

    // 1. Verify the requester is actually a Class Rep
    const { data: repProfile } = await supabase
      .from('student_profiles')
      .select('is_class_rep')
      .eq('matric_number', repMatric)
      .single();

    if (!repProfile?.is_class_rep) {
      return NextResponse.json({ error: "Unauthorized. Only Class Reps can do this." }, { status: 403 });
    }

    if (action === 'log_dead_battery') {
      if (!sessionId || !matricNumber) {
        return NextResponse.json({ error: "Missing session or matric" }, { status: 400 });
      }

      const cleanMatric = matricNumber.toUpperCase().trim();

      // 2. Check the 3-student cap
      const { count, error: countError } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('device_hash', 'rep-battery-log'); // We use this hash to track Rep logs

      if (countError) throw countError;

      if (count !== null && count >= 3) {
        return NextResponse.json({ error: "Limit reached. Only 3 students can claim battery dead per class." }, { status: 403 });
      }

      // 3. Check if the student already has a log
      const { data: existingLog } = await supabase
        .from('attendance_logs')
        .select('id, status')
        .eq('session_id', sessionId)
        .eq('matric_number', cleanMatric)
        .single();

      if (existingLog) {
        if (existingLog.status === 'verified') {
           return NextResponse.json({ error: "Student is already verified." }, { status: 409 });
        }
        // Update existing log to pending_override
        await supabase.from('attendance_logs').update({
          status: 'pending_override',
          device_info: JSON.stringify({ method: "Class Rep - Battery Dead" }),
          device_hash: 'rep-battery-log'
        }).eq('id', existingLog.id);
      } else {
        // Insert new log
        await supabase.from('attendance_logs').insert([{
          session_id: sessionId,
          matric_number: cleanMatric,
          status: 'pending_override',
          device_info: JSON.stringify({ method: "Class Rep - Battery Dead" }),
          device_hash: 'rep-battery-log'
        }]);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Rep Action Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}