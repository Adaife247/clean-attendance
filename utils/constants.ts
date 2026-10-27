// ─── utils/constants.ts ───
// Central place for every magic number in the app.

// ── Geofencing ──
export const GEOFENCE_RADIUS_METERS = 250;
export const GEOFENCE_HARD_BLOCK_METERS = 500;
export const GPS_BROWSER_TIMEOUT_MS = 20_000;
export const GPS_OVERALL_TIMEOUT_MS = 25_000;
export const GPS_MIN_PINGS_TO_SEND = 1;
export const GPS_SEND_INTERVAL_MS = 4_000;
export const GPS_PREWARM_BUFFER_MAX = 30;

// ── Fingerprinting ──
export const FINGERPRINT_WAIT_MS = 6_000;

// ── Anchor caching (lecturer side) ──
export const ANCHOR_CACHE_KEY = 'campuscheck_anchor_cache';
export const ANCHOR_CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
export const ACTIVE_SESSION_KEY = 'active_attendance_session';
export const PREWARM_STALE_MS = 15_000; // 15s
// ── Student Portal ──
export const PORTAL_UNLOCK_GRACE_MS = 5 * 60 * 1000; // 5 minutes (lowered from 30 for security)

// ── Academic ──
export const NUC_MIN_ELIGIBLE_PERCENTAGE = 70;
export const DEFAULT_PLANNED_CLASSES = 15;
export const DEFAULT_MAX_ATTENDANCE_SCORE = 10;

// ── Auth / admin ──
export const ADMIN_COOKIE_NAME = 'attendance_admin_token';
export const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours
export const WEBAUTHN_CHALLENGE_COOKIE = 'webauthn_challenge';
export const WEBAUTHN_CHALLENGE_MAX_AGE_SECONDS = 300; // 5 min

// ── Rate limiting (in-memory) ──
export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
export const RATE_LIMIT_DEFAULTS = {
  'admin-login': 5,           // 5 attempts/min per IP
  'webauthn-auth-generate': 15,
  'webauthn-register-generate': 5,
  'verify-attendance': 20,
  'request-override': 5,
  'rep-action': 10,
  'rate-session': 10,
} as const;

// ── Storage keys ──
export const STORAGE_KEYS = {
  studentMatric: 'campuscheck_student_matric',
  deviceAnchor: 'campuscheck_device_anchor',
  offlineQueue: 'attendance_offline_queue',
  anchorCache: 'campuscheck_anchor_cache',
  activeSession: 'active_attendance_session',
  authToken: 'campuscheck_auth_token',
} as const;

// ── Student status meme tiers (attendance streak) ──
export const STREAK_TIERS = {
  odogwu: 10,
  consistent: 5,
  jjc: 1,
} as const;