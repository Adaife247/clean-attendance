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

    // 1. Check if they are already flagged
    const { data: existingLog, error: fetchError } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
       // PGRST116 just means "no rows found", which is normal for a new student. 
       // Any other error is a real crash.
       throw fetchError; 
    }

    if (existingLog) {
      // 2. Try to update
      const { error: updateError } = await supabase.from('attendance_logs').update({ 
        status: 'verified', 
        device_info: JSON.stringify({ method: "Manual Override - Updated" }) 
      }).eq('id', existingLog.id);
      
      if (updateError) throw updateError; // CRITICAL: Catch the error!
      
    } else {
      // 3. Try to insert
      const { error: insertError } = await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: 'verified',
        device_info: JSON.stringify({ method: "Manual Override - Inserted" })
      }]);
      
      if (insertError) throw insertError; // CRITICAL: Catch the error!
    }

    return NextResponse.json({ message: "Success" });
    
  } catch (error: any) {
    // 4. PRINT THE EXACT POSTGRES ERROR TO THE TERMINAL
    console.error("\n================ DATABASE REJECTED OVERRIDE ================");
    console.error("Error Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("============================================================\n");
    
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}