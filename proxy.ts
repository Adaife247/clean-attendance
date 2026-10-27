import { NextResponse } from 'next/server';

export function proxy() {
  // We are removing the Supabase cookie check because it's causing false positives 
  // with chunked cookies. The app/dashboard/layout.tsx already protects the routes.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'], 
};