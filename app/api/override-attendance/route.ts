import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const sessionId = body.sessionId || body.session_id || body.session;
    const rawMatric = body.matricNumber || body.matric_number || body.matric;

    if (!sessionId || !rawMatric) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    const cleanMatric = String(rawMatric).toUpperCase().trim();

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
          device_info: JSON.stringify({ method: "Manual Override - Updated" })
          // device_hash remains unchanged
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
          device_hash: 'manual-override'  // mark as manually added (no device fingerprint)
        }]);
      
      if (insertError) throw insertError;
    }

    return NextResponse.json({ message: "Success" });
    
  } catch (error: any) {
    console.error("\n================ DATABASE REJECTED OVERRIDE ================");
    console.error("Error Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("============================================================\n");
    
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}