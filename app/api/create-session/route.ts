import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseCodeToSave = body.courseCode || body.course_code;

    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code." }, { status: 400 });
    }

    // Generate a random 4-digit passcode for the Class Rep
    const repPasscode = Math.floor(1000 + Math.random() * 9000).toString();

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