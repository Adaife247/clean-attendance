import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check for the Supabase auth cookie (this is how Supabase handles sessions)
  const hasAuthCookie = request.cookies.getAll().some((cookie) => 
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );

  // 1. If they are on the homepage AND logged in -> send to dashboard
  if (path === '/' && hasAuthCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. If they try to access the dashboard BUT are not logged in -> send to login
  if (path.startsWith('/dashboard') && !hasAuthCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. If they try to access the HOD portal BUT are not logged in -> send to login
  if (path.startsWith('/hod') && !hasAuthCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// Only run middleware on these routes
export const config = {
  matcher: ['/', '/dashboard/:path*', '/hod/:path*'],
};