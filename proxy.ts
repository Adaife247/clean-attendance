import { NextResponse } from 'next/server';

export function proxy() {
  // NOTE: This file is currently a no-op.
  // 
  // Route protection is handled by:
  // 1. `app/dashboard/layout.tsx` — client-side JWT check on `/dashboard/*`
  // 2. `app/hod/page.tsx` — client-side JWT check on `/hod`
  // 3. `utils/api-auth.ts` — server-side JWT verification on all API routes
  // 
  // If you add a new route that needs protection and can't rely on the layout,
  // add its matcher below and implement a real cookie check here.
  
  return NextResponse.next();
}

export const config = {
  matcher: [], // Intentionally empty — protection is handled at the layout level
};