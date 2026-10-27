import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const rawMatric = body.matricNumber;

    if (!rawMatric) {
      return NextResponse.json({ message: "Matric number required." }, { status: 400 });
    }

    const cleanMatric = String(rawMatric).toUpperCase().trim();

    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('matric_number', cleanMatric);

    if (error) throw error;

    return NextResponse.json({ message: "Hardware binding successfully wiped." }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ message: "Failed to reset device." }, { status: 500 });
  }
}