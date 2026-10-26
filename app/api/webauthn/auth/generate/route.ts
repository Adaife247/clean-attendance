export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { rpID } from '@/utils/webauthn';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { RATE_LIMIT_DEFAULTS } from '@/utils/constants';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = RATE_LIMIT_DEFAULTS['webauthn-auth-generate'];
    const rateCheck = checkRateLimit(`auth-gen:${ip}`, limit);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const { matricNumber } = await request.json();
    
    if (!matricNumber || typeof matricNumber !== 'string') {
      return NextResponse.json({ error: "Matric number required." }, { status: 400 });
    }

    const cleanMatric = matricNumber.toUpperCase().trim();

    // 1. Check if the student exists in the DB at all (enrolled in any course)
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('matric_number', cleanMatric)
      .limit(1);

    const isEnrolled = enrollments && enrollments.length > 0;

    if (!isEnrolled) {
      // Distinct error so client can show "Ask your lecturer to add you"
      return NextResponse.json(
        { error: "NOT_ENROLLED", message: "This matric number isn't on any class roster yet. Ask your lecturer to upload your name." },
        { status: 404, headers: rateLimitHeaders(rateCheck) }
      );
    }

    // 2. Check if they have a registered device
    const { data: device, error } = await supabase
      .from('user_devices')
      .select('credential_id, transports')
      .eq('matric_number', cleanMatric)
      .single();

    if (error || !device) {
      // Enrolled but no biometrics yet — needs setup
      return NextResponse.json(
        { error: "NEEDS_SETUP", message: "This matric is enrolled but no phone is linked. Let's set it up." },
        { status: 404, headers: rateLimitHeaders(rateCheck) }
      );
    }

    // 3. Student is enrolled AND has biometrics — normal login
    let safeTransports = device.transports;
    if (typeof safeTransports === 'string') {
      try { safeTransports = JSON.parse(safeTransports); } catch { safeTransports = []; }
    }
    if (!Array.isArray(safeTransports)) safeTransports = ['internal'];

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: String(device.credential_id),
        transports: safeTransports,
      }],
      userVerification: 'preferred',
    });

    const cookieStore = await cookies();
    cookieStore.set('webauthn_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 300,
      path: '/',
    });

    return NextResponse.json(options, { headers: rateLimitHeaders(rateCheck) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}