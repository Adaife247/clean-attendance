import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseCodeToSave = body.courseCode || body.course_code;

    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code." }, { status: 400 });
    }

    // Entropy Upgrade: Generate a 6-character alphanumeric passcode for the Class Rep
    const repPasscode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([{
        course_code: courseCodeToSave, 
        anchor_latitude: body.latitude || body.lat, 
        anchor_longitude: body.longitude || body.lng, 
        is_active: true,
        rep_passcode: repPasscode
      }])
      .select('session_id') 
      .single();

    if (error) throw error;

    return NextResponse.json({ sessionId: data.session_id });
    
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}