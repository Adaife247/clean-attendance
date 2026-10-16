import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Initialize Supabase INSIDE the handler so env vars are loaded at request time
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await request.json();
    const courseCodeToSave = body.courseCode || body.course_code;

    // Extract duration in minutes from the frontend (default to 60 minutes if missing)
    const durationMinutes = parseInt(body.duration) || 60;

    if (!courseCodeToSave) {
      return NextResponse.json({ error: "Missing course code." }, { status: 400 });
    }

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([{
        course_code: courseCodeToSave,
        anchor_latitude: body.latitude || body.lat,
        anchor_longitude: body.longitude || body.lng,
        is_active: true,
        expires_at: expiresAt // Storing the strict countdown timer
      }])
      .select('session_id')
      .single();

    if (error) throw error;

    return NextResponse.json({
      sessionId: data.session_id,
      expiresAt: expiresAt
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}