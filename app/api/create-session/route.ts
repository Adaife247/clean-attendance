import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { courseCode, latitude, longitude } = await request.json();

    if (!courseCode || !latitude || !longitude) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Insert the new session and instantly return the generated ID
    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([
        { 
          course_code: courseCode.toUpperCase(), 
          anchor_latitude: latitude, 
          anchor_longitude: longitude, 
          is_active: true 
        }
      ])
      .select('session_id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ sessionId: data.session_id }, { status: 200 });

  } catch (error) {
    console.error("Session Creation Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}