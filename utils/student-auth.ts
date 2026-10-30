// utils/student-auth.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { STUDENT_JWT_TTL_SECONDS, STUDENT_JWT_ISSUER, STUDENT_JWT_AUDIENCE } from './constants';
import { scoped } from './logger';

const log = scoped('student-auth');
const getSecret = () => process.env.JWT_SECRET || '';

// Base64URL helpers
function base64url(str: string | Buffer): string {
  return Buffer.from(str).toString('base64url');
}

function parseBase64url(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Signs a new JWT for a verified student.
 */
export function signStudentToken(matricNumber: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("JWT_SECRET environment variable is missing.");

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + STUDENT_JWT_TTL_SECONDS;
  
  const payload = base64url(JSON.stringify({
    matric: matricNumber.toUpperCase().trim(),
    iss: STUDENT_JWT_ISSUER,
    aud: STUDENT_JWT_AUDIENCE,
    exp
  }));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export interface StudentAuthResult {
  matric?: string;
  error?: NextResponse;
}

/**
 * Verifies the Bearer token on incoming student requests.
 */
export function verifyStudentToken(request: Request): StudentAuthResult {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 }) };
  }

  const token = authHeader.split(' ')[1];
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { error: NextResponse.json({ error: 'Unauthorized: Malformed token' }, { status: 401 }) };
  }

  const [headerB64, payloadB64, signature] = parts;
  const secret = getSecret();
  if (!secret) {
    log.error('JWT_SECRET is missing on the server.');
    return { error: NextResponse.json({ error: 'Server configuration error' }, { status: 500 }) };
  }

  // 1. Verify Signature (Timing Safe)
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { error: NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 }) };
  }

  // 2. Verify Payload
  try {
    const payload = JSON.parse(parseBase64url(payloadB64));
    
    // Check Expiry
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return { error: NextResponse.json({ error: 'Unauthorized: Token expired' }, { status: 401 }) };
    }
    
    // Check Issuer/Audience
    if (payload.iss !== STUDENT_JWT_ISSUER || payload.aud !== STUDENT_JWT_AUDIENCE) {
      return { error: NextResponse.json({ error: 'Unauthorized: Invalid token claims' }, { status: 401 }) };
    }

    if (!payload.matric) {
      return { error: NextResponse.json({ error: 'Unauthorized: Missing matric' }, { status: 401 }) };
    }

    return { matric: payload.matric };
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized: Invalid payload' }, { status: 401 }) };
  }
}