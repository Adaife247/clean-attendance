export const dynamic = 'force-dynamic';
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

    if (!expectedChallenge) return NextResponse.json({ error: "Session expired." }, { status: 400 });

    const verification = await verifyRegistrationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      // IMMUNE POSTGRES FORMAT: Prefixing with \x prevents all database corruption
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