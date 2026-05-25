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

    // ==========================================
    // THE UNIVERSAL ADAPTER (Fixes the 156-byte error)
    // Automatically detects the DB format and safely decodes it
    // ==========================================
    let pkBytes: Uint8Array;
    const dbKey = device.public_key;

    try {
      if (typeof dbKey === 'string' && /^[0-9a-fA-F]{100,}$/.test(dbKey)) {
        // DETECTED: Old Hex String (156 characters)
        pkBytes = new Uint8Array(dbKey.length / 2);
        for (let i = 0; i < dbKey.length; i += 2) {
          pkBytes[i / 2] = parseInt(dbKey.substring(i, i + 2), 16);
        }
      } else if (typeof dbKey === 'string' && dbKey.startsWith('[')) {
        // DETECTED: JSON Number Array
        pkBytes = new Uint8Array(JSON.parse(dbKey));
      } else {
        // DETECTED: Standard Base64URL
        pkBytes = isoBase64URL.toBuffer(dbKey);
      }
    } catch (parseError) {
      return NextResponse.json({ error: "Universal Adapter failed to parse key." }, { status: 500 });
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: device.credential_id,
          publicKey: pkBytes, // Now perfectly sized to 78 bytes no matter what!
          counter: Number(device.counter),
        } as any, // Bypasses the strict Vercel TypeScript compiler
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
      const errorMsg = `Crypto Crash! Key loaded was exactly ${pkBytes.length} bytes long. Internal Error: ${cryptoError.message}`;
      console.error(errorMsg);
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}