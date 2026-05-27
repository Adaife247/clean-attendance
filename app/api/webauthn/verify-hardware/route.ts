import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. We moved the client setup INSIDE the function!
    // Now Next.js won't crash during the build phase.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server missing database credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. The rest of the logic remains exactly the same
    const body = await request.json();
    const { matricNumber, hardwareFingerprint } = body;

    if (!matricNumber || !hardwareFingerprint) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('students')
      .select('hardware_fingerprint')
      .eq('matric_number', matricNumber)
      .single();

    if (error || !data) {
      return NextResponse.json({ isMatch: false });
    }

    if (data.hardware_fingerprint === hardwareFingerprint) {
      return NextResponse.json({ isMatch: true });
    } else {
      return NextResponse.json({ isMatch: false });
    }

  } catch (error) {
    const e = error as Error; // Fixed the "any" type error here too!
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}