import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { rpName, rpID } from '../../../../../utils/webauthn';

export async function POST(request: Request) {
  try {
    const { matricNumber } = await request.json();
    const cleanMatric = matricNumber.toUpperCase().trim();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(cleanMatric),
      userName: cleanMatric,
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // BLOCKS CLOUD PASSKEYS - FORCES DEVICE HARDWARE
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