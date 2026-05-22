import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createClient } from '@supabase/supabase-js';
import { rpID } from '../../../../../utils/webauthn';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  try {
    const { matricNumber } = await request.json();
    const cleanMatric = matricNumber.toUpperCase().trim();

    const { data: device, error } = await supabase
      .from('user_devices')
      .select('credential_id, transports')
      .eq('matric_number', cleanMatric)
      .single();

    if (error || !device) {
      return NextResponse.json({ error: "Device not registered" }, { status: 404 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: String(device.credential_id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        type: 'public-key',
        transports: device.transports,
      }] as any[], 
      userVerification: 'preferred',
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