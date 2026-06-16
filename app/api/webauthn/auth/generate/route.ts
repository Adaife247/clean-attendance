export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { rpID } from '@/utils/webauthn';

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

    let safeTransports = device.transports;
    if (typeof safeTransports === 'string') {
      try { safeTransports = JSON.parse(safeTransports); } catch(e) { safeTransports = []; }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: String(device.credential_id),
        type: 'public-key',
        transports: safeTransports || [],
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