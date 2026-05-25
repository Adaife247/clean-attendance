export const dynamic = 'force-dynamic'; // NUKES VERCEL CACHE
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
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

    const { data: device, error } = await supabase
      .from('user_devices')
      .select('credential_id, public_key, counter')
      .eq('matric_number', cleanMatric)
      .single();

    if (error || !device) return NextResponse.json({ error: "Device record missing." }, { status: 404 });

    // TRIPWIRE: Expose exactly what Supabase handed back
    console.log(`[VERIFY] Key Type in DB: ${typeof device.public_key}`);
    console.log(`[VERIFY] Key String Length: ${String(device.public_key).length}`);

    let pkBytes: Uint8Array;
    try {
      pkBytes = isoBase64URL.toBuffer(String(device.public_key));
      console.log(`[VERIFY] Decoded to Uint8Array. Byte length: ${pkBytes.length}`);
    } catch (parseError: any) {
      console.error("[VERIFY DECODE CRASH]", parseError);
      return NextResponse.json({ error: `Decode failed: ${parseError.message}` }, { status: 500 });
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: device.credential_id,
          publicKey: pkBytes,
          counter: Number(device.counter),
        } as any,
      });

      if (verification.verified) {
        await supabase
          .from('user_devices')
          .update({ counter: verification.authenticationInfo.newCounter })
          .eq('matric_number', cleanMatric);

        cookieStore.delete('webauthn_challenge');
        return NextResponse.json({ verified: true });
      }
    } catch (cryptoError: any) {
      console.error("[VERIFY CRYPTO CRASH]", cryptoError);
      return NextResponse.json({ error: `Crypto Crash: ${cryptoError.message}` }, { status: 500 });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    console.error("[VERIFY FATAL ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}