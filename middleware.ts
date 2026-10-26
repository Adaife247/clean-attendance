import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if the user is logged in as a lecturer
  const hasAuthCookie = request.cookies.getAll().some((cookie) => 
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );

  // Protect dashboard routes (must be logged in)
  if (path.startsWith('/dashboard') && !hasAuthCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protect HOD routes
  if (path.startsWith('/hod') && !hasAuthCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Let them see the homepage (/) even if they are logged in.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/hod/:path*'],
};