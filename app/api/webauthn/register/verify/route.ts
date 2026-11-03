export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { rpID, origin } from '@/utils/webauthn';
import { FLAG_REASONS } from '@/utils/flag-reasons';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matricNumber, authResponse, hardwareFingerprint, deviceId, deviceFingerprint } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!hardwareFingerprint || !deviceId || !deviceFingerprint) {
      return NextResponse.json({ error: "Device fingerprint data missing." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;

    if (!expectedChallenge) return NextResponse.json({ error: "Session expired." }, { status: 400 });

    // Get IP and User Agent for collision context
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : (headersList.get('x-real-ip') || 'unknown');
    const ua = headersList.get('user-agent') || 'unknown';

    // ─── 1. CONTEXTUAL COLLISION RESOLUTION ───
    // Look up the most recent registration on this exact hardware fingerprint
    const { data: existingHwDevice } = await supabase
      .from('user_devices')
      .select('matric_number, registration_ip, created_at')
      .eq('hardware_fingerprint', hardwareFingerprint)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingHwDevice && existingHwDevice.matric_number !== cleanMatric) {
      const sameIp = existingHwDevice.registration_ip === ip;
      const timeGapMs = Date.now() - new Date(existingHwDevice.created_at).getTime();
      const thirtyMinutes = 30 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;

      // Scenario A: Same IP and < 30 mins apart. Highly likely proxy.
      if (sameIp && timeGapMs < thirtyMinutes) {
        cookieStore.delete('webauthn_challenge');
        return NextResponse.json(
          { 
            error: FLAG_REASONS.DUPLICATE_HARDWARE.messageStudent,
            code: 'DUPLICATE_HARDWARE' 
          },
          { status: 409 }
        );
      }

      // Scenario B: Same IP (any time) OR < 1 hour apart. Ambiguous (could be identical phones).
      if (sameIp || timeGapMs < oneHour) {
        // Write a soft flag for the lecturer to review, but allow the registration to proceed.
        await supabase.from('registration_flags').insert({
          matric_number: cleanMatric,
          hardware_fingerprint: hardwareFingerprint,
          reason_code: 'AMBIGUOUS_COLLISION',
          reason_detail: JSON.stringify({
            previous_matric: existingHwDevice.matric_number,
            previous_ip: existingHwDevice.registration_ip,
            current_ip: ip,
            time_gap_minutes: Math.round(timeGapMs / 60000)
          }),
          ip_address: ip
        });
      }
      
      // Scenario C: Different IP and > 1 hour apart. Silently allow (likely two identical phones).
    }

    // ─── 2. VERIFY WEBAUTHN ───
    const { data: existingDevice } = await supabase
      .from('user_devices')
      .select('credential_id')
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    const verification = await verifyRegistrationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ verified: false }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    if (existingDevice && existingDevice.credential_id !== credential.id) {
      cookieStore.delete('webauthn_challenge');
      return NextResponse.json(
        { error: "This matric is already linked to another phone. Ask your lecturer to reset it." },
        { status: 409 }
      );
    }

    const hex = Array.from(credential.publicKey).map(b => b.toString(16).padStart(2, '0')).join('');
    const immuneKey = `\\x${hex}`;

    // ─── 3. SAVE DEVICE ───
    const { error: dbError } = await supabase
      .from('user_devices')
      .upsert({
        matric_number: cleanMatric,
        credential_id: credential.id,
        public_key: immuneKey,
        counter: credential.counter,
        transports: credential.transports || [],
        
        device_hash: deviceFingerprint, 
        hardware_fingerprint: hardwareFingerprint, 
        local_device_id: deviceId,
        registration_ip: ip,
        registration_ua: ua,
        
        created_at: new Date().toISOString()
      }, { onConflict: 'matric_number' });

    if (dbError) throw dbError;

    cookieStore.delete('webauthn_challenge');
    return NextResponse.json({ verified: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}