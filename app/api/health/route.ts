// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Ping the DB with a minimal query to ensure the connection is alive
    const { error } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      return NextResponse.json({ status: 'error', message: 'Database unreachable' }, { status: 503 });
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch {
    return NextResponse.json({ status: 'error', message: 'Health check failed' }, { status: 500 });
  }
}