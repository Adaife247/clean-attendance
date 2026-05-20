import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If someone tries to access the dashboard...
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    // Check if they have the secret VIP stamp (cookie)
    const isAdmin = request.cookies.get('attendance_admin_token');

    // If they don't have it, instantly kick them to the login page
    if (!isAdmin || isAdmin.value !== 'verified') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If they have the stamp, let them pass
  return NextResponse.next();
}

// Tell the bouncer to only watch the dashboard routes to save server speed
export const config = {
  matcher: ['/dashboard/:path*'],
};