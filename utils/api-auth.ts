import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from './supabase-admin';

export async function verifyLecturer(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 }) };
  }

  const token = authHeader.split(' ')[1];
  
  // Verify the token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 }) };
  }

  // Check if they are actually a lecturer in the DB
  const { data: profile } = await supabase
    .from('lecturers')
    .select('id, department')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: 'Forbidden: Lecturer access required' }, { status: 403 }) };
  }

  return { user: profile };
}