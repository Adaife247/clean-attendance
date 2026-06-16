import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseCode = searchParams.get('courseCode');

  if (!courseCode) return NextResponse.json({ message: "Missing course code" }, { status: 400 });

  const { data: sessions, error } = await supabase
    .from('lecture_sessions')
    .select('session_id, created_at, course_code')
    .eq('course_code', courseCode)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ message: "Database error" }, { status: 500 });
  return NextResponse.json(sessions || []);
}