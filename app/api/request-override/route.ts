import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyStudentToken } from '@/utils/student-auth';

export async function POST(request: Request) {
  try {
    const auth = verifyStudentToken(request);
    if (auth.error) return auth.error;

    const { sessionId } = await request.json();
    // Trust the matric from the verified token, not the request body
    const cleanMatric = auth.matric!; 

    if (!sessionId) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

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
      
      await supabase.from('attendance_logs').update({ 
        status: 'pending_override',
        device_info: JSON.stringify({ method: "Digital Hand Raise" }) 
      }).eq('id', existingLog.id);
      
    } else {
      await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: 'pending_override',
        device_info: JSON.stringify({ method: "Digital Hand Raise" })
      }]);
    }

    return NextResponse.json({ message: "Appeal requested successfully" }, { status: 200 });

  } catch {
    return NextResponse.json({ message: "Failed to request appeal" }, { status: 500 });
  }
}