import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function POST(request: Request) {
  try {
    const { title, content, author } = await request.json();
    
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { error } = await supabase.from('campus_updates').insert([{
      title, 
      content, 
      author: author || 'Lecturer'
    }]);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to post update' }, { status: 500 });
  }
}