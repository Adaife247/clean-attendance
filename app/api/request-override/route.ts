import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const { sessionId, matricNumber } = await request.json();
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!sessionId || !cleanMatric) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    // Check if they are already in the system
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog) {
      if (existingLog.status === 'verified') {
        return NextResponse.json({ message: "You are already verified." }, { status: 409 });
      }
      
      // Update their failed/flagged status to the appeal queue
      await supabase.from('attendance_logs').update({ 
        status: 'pending_override',
        device_info: JSON.stringify({ method: "Digital Hand Raise" }) 
      }).eq('id', existingLog.id);
      
    } else {
      // Insert them directly into the appeal queue
      await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: 'pending_override',
        device_info: JSON.stringify({ method: "Digital Hand Raise" })
      }]);
    }

    return NextResponse.json({ message: "Appeal requested successfully" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: "Failed to request appeal" }, { status: 500 });
  }
}