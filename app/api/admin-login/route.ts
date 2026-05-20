import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    // HARDCODED PASSWORD (For testing. In production, put this in your .env file)
    const CORRECT_PASSWORD = "fuoye2026"; 

    if (password === CORRECT_PASSWORD) {
      // Next.js 15 requires awaiting the cookies API before setting them
      const cookieStore = await cookies();
      
      // Give them the secure HTTP-only cookie that lasts for 8 hours
      cookieStore.set({
        name: 'attendance_admin_token',
        value: 'verified',
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 8, // 8 hours
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Invalid password" }, { status: 401 });
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}