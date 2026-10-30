import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyStudentToken } from '@/utils/student-auth';

interface RateBody {
  sessionId: string;
  rating: number;
  tags: string[];
}

export async function POST(request: Request) {
  try {
    const auth = verifyStudentToken(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as RateBody;
    const { sessionId, rating, tags } = body;
    
    // Trust the matric from the token
    const cleanMatric = auth.matric!;

    if (!sessionId || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid rating payload' }, { status: 400 });
    }

    const { data: log } = await supabase
      .from('attendance_logs')
      .select('status')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (!log || log.status !== 'verified') {
      return NextResponse.json({ error: 'You must be verified to rate this session.' }, { status: 403 });
    }

    const cleanTags = Array.isArray(tags)
      ? tags.filter(t => typeof t === 'string').slice(0, 10)
      : [];

    const { error } = await supabase
      .from('session_ratings')
      .insert([{
        session_id: sessionId,
        rating,
        tags: cleanTags,
      }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record rating';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}