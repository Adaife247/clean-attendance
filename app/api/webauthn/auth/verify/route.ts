import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { rpID, origin } from '../../../../../utils/webauthn';
import { Buffer } from 'buffer';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matricNumber, authResponse } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;

    if (!expectedChallenge) return NextResponse.json({ error: "Session expired." }, { status: 400 });

    const { data: device } = await supabase
      .from('user_devices')
      .select('credential_id, public_key, counter')
      .eq('matric_number', cleanMatric)
      .single();

    if (!device) return NextResponse.json({ error: "Device record missing." }, { status: 404 });

    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        // THE FIX: Pass the exact credential ID from the database
        id: device.credential_id,
        publicKey: new Uint8Array(Buffer.from(device.public_key, 'base64')),
        counter: Number(device.counter),
      },
    });

    if (verification.verified) {
      await supabase
        .from('user_devices')
        .update({ counter: verification.authenticationInfo.newCounter })
        .eq('matric_number', cleanMatric);

      cookieStore.delete('webauthn_challenge');
      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}