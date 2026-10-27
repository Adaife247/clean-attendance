import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { RATE_LIMIT_DEFAULTS } from '@/utils/constants';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  const maxLen = Math.max(bufA.length, bufB.length);
  const padA = Buffer.alloc(maxLen);
  const padB = Buffer.alloc(maxLen);
  bufA.copy(padA);
  bufB.copy(padB);

  const equal = crypto.timingSafeEqual(padA, padB);
  return equal && bufA.length === bufB.length;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = RATE_LIMIT_DEFAULTS['admin-login'];
    const rateCheck = checkRateLimit(`admin-login:${ip}`, limit);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: "Too many login attempts. Please try again in a minute." },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const { password } = await request.json();
    const CORRECT_PASSWORD = process.env.ADMIN_PASSWORD; 

    if (!CORRECT_PASSWORD) {
      return NextResponse.json({ message: "Server configuration missing." }, { status: 500 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ message: "Password required." }, { status: 400 });
    }

    if (safeCompare(password, CORRECT_PASSWORD)) {
      const cookieStore = await cookies();
      
      cookieStore.set({
        name: 'attendance_admin_token',
        value: 'verified',
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 8,
      });

      return NextResponse.json({ success: true }, { headers: rateLimitHeaders(rateCheck) });
    }

    return NextResponse.json(
      { message: "Invalid password" }, 
      { status: 401, headers: rateLimitHeaders(rateCheck) }
    );

  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}