import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import crypto from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  const padA = Buffer.alloc(maxLen);
  const padB = Buffer.alloc(maxLen);
  bufA.copy(padA);
  bufB.copy(padB);
  return crypto.timingSafeEqual(padA, padB) && bufA.length === bufB.length;
}

export async function POST(request: Request) {
  try {
    const { email, password, fullName, department, secretKey } = await request.json();

    if (!email || !password || !fullName || !department || !secretKey) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const serverKey = process.env.FACULTY_SECRET_KEY;
    if (!serverKey) {
      return NextResponse.json({ error: "Server configuration missing." }, { status: 500 });
    }

    // 1. Verify the secret key securely on the server
    if (!safeCompare(secretKey, serverKey)) {
      return NextResponse.json({ error: "Invalid Faculty Registration Key. Students cannot create accounts." }, { status: 403 });
    }

    // 2. Create the Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user account." }, { status: 500 });
    }

    // 3. Create the Lecturer Profile
    const { error: profileError } = await supabase.from('lecturers').insert([{
      id: authData.user.id, 
      email: email, 
      full_name: fullName, 
      department: department
    }]);

    if (profileError) {
      // Rollback: delete the auth user if the profile insertion fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Failed to create lecturer profile." }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}