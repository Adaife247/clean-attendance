import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // THE FIX: Specifically target 'courseCode' so it grabs "GST401", NOT the UUID
    const courseCodeToSave = body.courseCode || body.course_code;

    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code. Check frontend payload." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([{
        course_code: courseCodeToSave, 
        anchor_latitude: body.latitude || body.lat, 
        anchor_longitude: body.longitude || body.lng, 
        is_active: true 
      }])
      .select('session_id') 
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error);
      throw error;
    }

    return NextResponse.json({ sessionId: data.session_id });
    
  } catch (err: any) {
    console.error("Critical API Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}