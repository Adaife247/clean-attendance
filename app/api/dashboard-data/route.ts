import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// MAGIC FIX: This forces Next.js to NEVER cache this route. 
// Without this, the dashboard will get stuck and not show new students!
export const dynamic = 'force-dynamic'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    // Grab the session ID from the URL (e.g., /api/dashboard-data?sessionId=123...)
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ message: "Missing Session ID" }, { status: 400 });
    }

    // 1. Fetch the Lecture Session Details
    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('course_code, is_active, created_at')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ message: "Session not found" }, { status: 404 });
    }

    // 2. Fetch the Attendance Logs & Join with Student Profiles
    const { data: logs, error: logsError } = await supabase
      .from('attendance_logs')
      .select(`
        log_id,
        status,
        timestamp,
        profiles (
          matric_number,
          full_name
        )
      `)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false }); // Newest check-ins at the top

    if (logsError) {
      throw new Error(logsError.message);
    }

    // 3. Format the data perfectly for the frontend UI
    const formattedLogs = logs.map((log: any) => ({
      id: log.log_id,
      matricNumber: log.profiles?.matric_number || 'Unknown',
      status: log.status,
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));

    return NextResponse.json({ 
      course: session.course_code,
      isActive: session.is_active,
      logs: formattedLogs 
    }, { status: 200 });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}