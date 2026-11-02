import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    // Rate limit: 5 email saves per minute per IP
    const rateCheck = await checkRateLimit(`save-email:${ip}`, 5, 60_000);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const { matricNumber, recoveryEmail } = await request.json();

    if (!matricNumber || !recoveryEmail || !recoveryEmail.includes('@')) {
      return NextResponse.json({ error: "Invalid data provided." }, { status: 400 });
    }

    const cleanMatric = matricNumber.toUpperCase().trim();
    const cleanEmail = recoveryEmail.trim().toLowerCase();

    // 1. Verify they are actually enrolled
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('matric_number', cleanMatric)
      .limit(1);

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ error: "Matric number is not enrolled in any course." }, { status: 403 });
    }

    // 2. Check if they already have a credential (if so, they shouldn't be onboarding)
    const { data: existingDevice } = await supabase
      .from('user_devices')
      .select('credential_id')
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (existingDevice) {
      return NextResponse.json({ error: "This matric already has a linked phone." }, { status: 409 });
    }

    // 3. Save the email
    const { error: profileError } = await supabase
      .from('student_profiles')
      .upsert({
        matric_number: cleanMatric,
        recovery_email: cleanEmail,
      }, { onConflict: 'matric_number' });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true }, { headers: rateLimitHeaders(rateCheck) });

  } catch (error) {
    console.error("Save Email API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}