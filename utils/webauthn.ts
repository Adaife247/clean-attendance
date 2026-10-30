// utils/webauthn.ts
// The name that shows up in the FaceID / TouchID prompt
export const rpName = 'CampusCheck';

// The domain MUST match the URL the student is on.
// If they are on campuscheck-live.vercel.app, this must be campuscheck-live.vercel.app
const vercelDomain = process.env.NEXT_PUBLIC_VERCEL_URL || 'campuscheck-live.vercel.app';
const customDomain = process.env.NEXT_PUBLIC_DOMAIN;

// NEW: Fail fast in production if the domain isn't set correctly
if (process.env.NODE_ENV === 'production' && !customDomain && !process.env.NEXT_PUBLIC_VERCEL_URL) {
  console.warn("⚠️ WEBAUTHN WARNING: Neither NEXT_PUBLIC_DOMAIN nor NEXT_PUBLIC_VERCEL_URL is set. Falling back to hardcoded domain.");
}

export const rpID = process.env.NODE_ENV === 'production' 
  ? (customDomain || vercelDomain) 
  : 'localhost';

export const origin = process.env.NODE_ENV === 'production' 
  ? `https://${rpID}` 
  : 'http://localhost:3000';