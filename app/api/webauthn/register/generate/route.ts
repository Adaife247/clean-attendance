export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { rpName, rpID } from '../../../../../utils/webauthn';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const { matricNumber, hardwareFingerprint } = await request.json();
    const cleanMatric = matricNumber.toUpperCase().trim();

    // --- THE INCOGNITO / PROXY KILLER ---
    if (hardwareFingerprint && hardwareFingerprint !== 'unknown-hardware') {
      const { data: existingDevice } = await supabase
        .from('user_devices')
        .select('matric_number')
        .eq('device_hash', hardwareFingerprint)
        .single();

      if (existingDevice && existingDevice.matric_number !== cleanMatric) {
        return NextResponse.json(
          { error: `Hardware Block: This physical device is permanently bound to ${existingDevice.matric_number}. Proxy registration denied.` },
          { status: 403 }
        );
      }
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(cleanMatric),
      userName: cleanMatric,
      authenticatorSelection: {
        // REMOVED: authenticatorAttachment: 'platform' 
        // This is the fix for iPhones without iCloud Keychain active.
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

    return NextResponse.json(options);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}