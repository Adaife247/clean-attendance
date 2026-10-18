import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const { title, content, author, course_code } = await request.json();
    
    if (!title || !content || !course_code) {
      return NextResponse.json({ error: 'Title, content, and course_code are required' }, { status: 400 });
    }

    const { error } = await supabase.from('campus_updates').insert([{
      title, 
      content, 
      author: author || 'Lecturer',
      course_code // Now saves the target class!
    }]);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to post update' }, { status: 500 });
  }
}