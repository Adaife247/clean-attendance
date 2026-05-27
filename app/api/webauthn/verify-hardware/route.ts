import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client to bypass RLS for this secure check
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use the secret service key, NOT the anon key
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matricNumber, hardwareFingerprint } = body;

    if (!matricNumber || !hardwareFingerprint) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Check the database for this specific student
    // NOTE: Change 'students' to whatever table name holds your registered WebAuthn users
    const { data, error } = await supabase
      .from('students')
      .select('hardware_fingerprint')
      .eq('matric_number', matricNumber)
      .single();

    if (error || !data) {
      // If the student doesn't exist in the DB, the cache is definitely stale
      return NextResponse.json({ isMatch: false });
    }

    // Compare the hardware fingerprint from the phone with the one in the database
    if (data.hardware_fingerprint === hardwareFingerprint) {
      // The physical phone matches the database record. This is a legitimate device block.
      return NextResponse.json({ isMatch: true });
    } else {
      // The phone does NOT match the database. This is a ghost/iCloud cache.
      return NextResponse.json({ isMatch: false });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}