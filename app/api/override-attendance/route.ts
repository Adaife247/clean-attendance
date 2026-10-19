import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const sessionId = body.sessionId || body.session_id || body.session;
    const rawMatric = body.matricNumber || body.matric_number || body.matric;
    const lecturerId = body.lecturerId || body.lecturer_id || null;

    if (!sessionId || !rawMatric) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    const cleanMatric = String(rawMatric).toUpperCase().trim();
    const overrideTimestamp = new Date().toISOString();

    // 1. Check if they already have a log entry
    const { data: existingLog, error: fetchError } = await supabase
      .from('attendance_logs')
      .select('id, device_hash')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existingLog) {
      // Update existing log: set status to verified, keep existing device_hash
      const { error: updateError } = await supabase
        .from('attendance_logs')
        .update({
          status: 'verified',
          device_info: JSON.stringify({ method: "Manual Override - Updated" }),
          approved_by: lecturerId,
          override_timestamp: overrideTimestamp,
        })
        .eq('id', existingLog.id);

      if (updateError) throw updateError;

    } else {
      // Insert new log for a student who never tried to check in
      const { error: insertError } = await supabase
        .from('attendance_logs')
        .insert([{
          session_id: sessionId,
          matric_number: cleanMatric,
          status: 'verified',
          device_info: JSON.stringify({ method: "Manual Override - Inserted" }),
          device_hash: 'manual-override',
          approved_by: lecturerId,
          override_timestamp: overrideTimestamp,
        }]);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ message: "Success" });

  } catch (error) {
    const e = error as { code?: string; message?: string; details?: string };

    console.error("\n================ DATABASE REJECTED OVERRIDE ================");
    console.error("Error Code:", e.code);
    console.error("Message:", e.message);
    console.error("Details:", e.details);
    console.error("============================================================\n");

    return NextResponse.json(
      { message: e.message || "Override failed" },
      { status: 500 }
    );
  }
}