import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if the user is logged in
  const hasAuthCookie = request.cookies.getAll().some((cookie) => 
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );

  // If they hit the root URL and are logged in, send them to /dashboard (which loads Live Radar)
  if (path === '/' && hasAuthCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect dashboard routes
  if (path.startsWith('/dashboard') && !hasAuthCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/hod/:path*'],
};