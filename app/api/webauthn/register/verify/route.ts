import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { rpID, origin } from '../../../../../utils/webauthn';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matricNumber, authResponse } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: "Session expired." }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      // THE FOOLPROOF FIX: Convert raw bytes to a simple array of numbers.
      // This prevents ANY encoding corruption by Node.js or Postgres.
      const publicKeyArray = Array.from(credential.publicKey);
      const publicKeyJson = JSON.stringify(publicKeyArray);

      const { error: dbError } = await supabase
        .from('user_devices')
        .upsert({
          matric_number: cleanMatric,
          credential_id: credential.id,
          public_key: publicKeyJson, 
          counter: credential.counter,
          transports: credential.transports || [],
          created_at: new Date().toISOString()
        }, { onConflict: 'matric_number' });

      if (dbError) throw dbError;

      cookieStore.delete('webauthn_challenge');
      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}