export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { rpName, rpID } from '@/utils/webauthn';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { RATE_LIMIT_DEFAULTS } from '@/utils/constants';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = RATE_LIMIT_DEFAULTS['webauthn-register-generate'];
    const rateCheck = checkRateLimit(`reg-gen:${ip}`, limit);

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

    // 1. Must be enrolled in at least one course to register
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('matric_number', cleanMatric)
      .limit(1);

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json(
        { error: "NOT_ENROLLED", message: "Your matric isn't on any roster yet. Ask your lecturer to add you first." },
        { status: 403, headers: rateLimitHeaders(rateCheck) }
      );
    }

    // 2. Check if this matric is already registered to a device
    const { data: existingDevice } = await supabase
      .from('user_devices')
      .select('matric_number')
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (existingDevice) {
      // Already registered — they should log in, not register again
      return NextResponse.json(
        { error: "ALREADY_REGISTERED", message: "This matric already has a linked phone. Log in instead." },
        { status: 409, headers: rateLimitHeaders(rateCheck) }
      );
    }

    // 3. Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(cleanMatric),
      userName: cleanMatric,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required', 
      },
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