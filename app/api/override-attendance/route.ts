import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Aggressive catching: Look for every possible way your frontend might name these variables
    const sessionId = body.sessionId || body.session_id || body.session;
    const rawMatric = body.matricNumber || body.matric_number || body.matric;

    if (!sessionId || !rawMatric) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    const cleanMatric = String(rawMatric).toUpperCase().trim();

    // Check if they are already flagged
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog) {
      // Update existing flagged student
      await supabase.from('attendance_logs').update({ 
        status: 'verified', 
        device_info: JSON.stringify({ method: "Manual Override - Updated" }) 
      }).eq('id', existingLog.id);
    } else {
      // Insert new student
      await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: 'verified',
        device_info: JSON.stringify({ method: "Manual Override - Inserted" })
      }]);
    }

    return NextResponse.json({ message: "Success" });
  } catch (error) {
    console.error("Override Error:", error);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}