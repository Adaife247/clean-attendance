export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { rpID, origin } from '@/utils/webauthn';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matricNumber, authResponse, deviceFingerprint } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!deviceFingerprint || deviceFingerprint === 'unknown') {
      return NextResponse.json({ error: "Device fingerprint missing. Refresh and try again." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;

    if (!expectedChallenge) return NextResponse.json({ error: "Session expired." }, { status: 400 });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Check if this DEVICE FINGERPRINT was used by another matric TODAY
    const { data: deviceReuse } = await supabase
      .from('user_devices')
      .select('matric_number')
      .eq('device_hash', deviceFingerprint)
      .gte('created_at', startOfToday.toISOString())
      .neq('matric_number', cleanMatric)
      .limit(1);

    if (deviceReuse && deviceReuse.length > 0) {
      return NextResponse.json(
        { error: "This phone has already been used to set up another student's account today. You cannot register multiple students on one phone." },
        { status: 409 }
      );
    }

    // 2. Check if this matric already has a credential
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

    const { error: dbError } = await supabase
      .from('user_devices')
      .upsert({
        matric_number: cleanMatric,
        credential_id: credential.id,
        public_key: immuneKey,
        counter: credential.counter,
        transports: credential.transports || [],
        device_hash: deviceFingerprint,
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