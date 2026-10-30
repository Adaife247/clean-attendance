// ─── utils/api-client.ts ───
// One place to build Authorization headers. Do not hand-roll these in
// components — different components were drifting (some sent
// `Bearer ` with an empty token, some omitted the header entirely).

import { supabase } from './supabase';
import { safeStorage } from './safe-storage';
import { STORAGE_KEYS } from './constants';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface LecturerHeadersOptions {
  /** Extra headers to merge in (e.g. Content-Type). */
  extra?: Record<string, string>;
}

/**
 * Headers for calls made by a signed-in lecturer.
 * Throws AuthError if there is no Supabase session — callers should
 * catch and redirect to /login.
 */
export async function getLecturerHeaders(
  opts: LecturerHeadersOptions = {}
): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new AuthError('Not signed in');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...opts.extra,
  };
}

export interface StudentHeadersOptions {
  /** Extra headers to merge in. */
  extra?: Record<string, string>;
  /** When true, missing token is treated as an error. Default true. */
  required?: boolean;
}

/**
 * Headers for calls made by a verified student (post-WebAuthn).
 * The token is minted by /api/webauthn/auth/verify (Batch 3) and
 * stored in sessionStorage.
 *
 * If `required` is false and no token exists, returns headers without
 * an Authorization entry — used by /api/verify-attendance, which
 * must accept an unauthenticated first check-in.
 */
export function getStudentHeaders(
  opts: StudentHeadersOptions = {}
): Record<string, string> {
  const required = opts.required ?? true;
  const token = safeStorage.getSessionString(STORAGE_KEYS.studentJwt);

  if (!token) {
    if (required) throw new AuthError('No student session — please unlock the portal.');
    return { 'Content-Type': 'application/json', ...opts.extra };
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...opts.extra,
  };
}

/**
 * For the rare endpoint that accepts both (e.g. rep actions where the
 * rep is a student but the action affects a course).
 */
export async function getBothHeaders(
  opts: { extra?: Record<string, string> } = {}
): Promise<Record<string, string>> {
  const lecturer = await supabase.auth.getSession();
  const student = safeStorage.getSessionString(STORAGE_KEYS.studentJwt);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.extra,
  };
  if (lecturer.data.session?.access_token) {
    headers.Authorization = `Bearer ${lecturer.data.session.access_token}`;
  } else if (student) {
    headers.Authorization = `Bearer ${student}`;
  }
  return headers;
}

/** Clears the student token. Call on portal lock / sign-out. */
export function clearStudentToken(): void {
  safeStorage.removeSession(STORAGE_KEYS.studentJwt);
}