import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMatric = body.matricNumber;

    if (!rawMatric) {
      return NextResponse.json({ message: "Matric number required." }, { status: 400 });
    }

    const cleanMatric = String(rawMatric).toUpperCase().trim();

    // Delete the device binding. This forces the student to re-register a new passkey.
    // Their attendance history remains perfectly intact in the attendance_logs table.
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('matric_number', cleanMatric);

    if (error) throw error;

    return NextResponse.json({ message: "Hardware binding successfully wiped." }, { status: 200 });

  } catch (error: any) {
    console.error("Device Reset Error:", error.message);
    return NextResponse.json({ message: "Failed to reset device." }, { status: 500 });
  }
}