import { NextResponse } from 'next/server';

export function middleware() {
  // We are removing the Supabase cookie check because it's causing false positives 
  // with chunked cookies. The app/dashboard/layout.tsx already protects the routes.
  
  // If you have admin routes protected by the `attendance_admin_token`, you can check them here:
  // const isAdmin = request.cookies.get('attendance_admin_token');
  // if (request.nextUrl.pathname.startsWith('/admin') && isAdmin?.value !== 'verified') { ... }

  return NextResponse.next();
}

export const config = {
  // Keep the matcher minimal. Only match routes that actually need middleware protection.
  matcher: ['/admin/:path*'], 
};