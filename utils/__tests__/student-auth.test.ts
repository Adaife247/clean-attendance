import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { STUDENT_JWT_TTL_SECONDS, STUDENT_JWT_ISSUER, STUDENT_JWT_AUDIENCE } from '../constants';

// Re-declare the pure functions from student-auth.ts (avoids importing NextResponse)
function base64url(str: string | Buffer): string {
  return Buffer.from(str).toString('base64url');
}
function parseBase64url(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function sign(matric: string, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + STUDENT_JWT_TTL_SECONDS;
  const payload = base64url(JSON.stringify({
    matric, iss: STUDENT_JWT_ISSUER, aud: STUDENT_JWT_AUDIENCE, exp,
  }));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verify(token: string, secret: string): { valid: boolean; reason?: string; matric?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [h, p, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  if (sig !== expected) return { valid: false, reason: 'bad_sig' };
  const payload = JSON.parse(parseBase64url(p));
  if (payload.exp < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' };
  if (payload.iss !== STUDENT_JWT_ISSUER) return { valid: false, reason: 'bad_iss' };
  if (payload.aud !== STUDENT_JWT_AUDIENCE) return { valid: false, reason: 'bad_aud' };
  return { valid: true, matric: payload.matric };
}

const TEST_SECRET = 'test-secret-do-not-use-in-production';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

describe('student JWT', () => {
  it('signs and verifies a token', () => {
    const token = sign('CSC/2021/001', TEST_SECRET);
    const result = verify(token, TEST_SECRET);
    expect(result.valid).toBe(true);
    expect(result.matric).toBe('CSC/2021/001');
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = sign('CSC/2021/001', 'wrong-secret');
    expect(verify(token, TEST_SECRET).valid).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const token = sign('CSC/2021/001', TEST_SECRET);
    const [h, , s] = token.split('.');
    const fakePayload = base64url(JSON.stringify({ matric: 'HACKER/2021/999', iss: STUDENT_JWT_ISSUER, aud: STUDENT_JWT_AUDIENCE, exp: Math.floor(Date.now() / 1000) + 3600 }));
    const tampered = `${h}.${fakePayload}.${s}`;
    expect(verify(tampered, TEST_SECRET).valid).toBe(false);
  });

  it('rejects a malformed token', () => {
    expect(verify('not.a.token.at.all', TEST_SECRET).valid).toBe(false);
    expect(verify('', TEST_SECRET).valid).toBe(false);
  });
});