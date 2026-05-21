import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Catch both camelCase and snake_case
    const courseId = body.courseId || body.course_id; 
    
    if (!courseId) return NextResponse.json({ error: "Missing course ID" }, { status: 400 });

    const { data, error } = await supabase.from('sessions').insert([{
      course_id: courseId, // Force it to map to your database column
      lat: body.latitude,
      lng: body.longitude,
      status: 'active'
    }]).select('id').single();

    if (error) throw error;
    return NextResponse.json({ sessionId: data.id });
  } catch (error) {
    console.error("Create Session Error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}