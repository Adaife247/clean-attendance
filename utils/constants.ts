// ─── utils/constants.ts ───
// Central place for every magic number in the app.

// ── Geofencing ──
export const GEOFENCE_RADIUS_METERS = 250;
export const GEOFENCE_INDOOR_RADIUS_METERS = 800; // NEW: For weak indoor GPS
export const GPS_WEAK_SIGNAL_THRESHOLD = 100;     // NEW: If accuracy > 100m, use indoor radius
export const GEOFENCE_HARD_BLOCK_METERS = 1500;   // NEW: Absolute max (prevents spoofing)
export const GPS_BROWSER_TIMEOUT_MS = 20_000;
export const GPS_OVERALL_TIMEOUT_MS = 25_000;
export const GPS_MIN_PINGS_TO_SEND = 1;
export const GPS_SEND_INTERVAL_MS = 4_000;
export const GPS_PREWARM_BUFFER_MAX = 30;

// ── Fingerprinting ──
export const FINGERPRINT_WAIT_MS = 6_000;

// ── Anchor caching (lecturer side) ──
export const ANCHOR_CACHE_KEY = 'campuscheck_anchor_cache';
export const ANCHOR_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
export const ACTIVE_SESSION_KEY = 'active_attendance_session';
export const PREWARM_STALE_MS = 15_000;

// ── Student Portal ──
export const PORTAL_UNLOCK_GRACE_MS = 15 * 60 * 1000;

// ── Academic ──
export const NUC_MIN_ELIGIBLE_PERCENTAGE = 70;
export const DEFAULT_PLANNED_CLASSES = 15;
export const DEFAULT_MAX_ATTENDANCE_SCORE = 10;

// ── Auth / admin ──
export const ADMIN_COOKIE_NAME = 'attendance_admin_token';
export const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;
export const WEBAUTHN_CHALLENGE_COOKIE = 'webauthn_challenge';
export const WEBAUTHN_CHALLENGE_MAX_AGE_SECONDS = 300;

// ── Student JWT ──
export const STUDENT_JWT_TTL_SECONDS = 30 * 60;
export const STUDENT_JWT_ISSUER = 'campuscheck';
export const STUDENT_JWT_AUDIENCE = 'campuscheck-student';

// ── Rate limiting ──
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_DEFAULTS = {
  'admin-login': 5,
  'webauthn-auth-generate': 15,
  'webauthn-register-generate': 5,
  'verify-attendance': 20,
  'request-override': 5,
  'rep-action': 30,
  'rate-session': 10,
  'post-feed': 10,
} as const;

// ── Storage keys ──
export const STORAGE_KEYS = {
  studentMatric: 'campuscheck_student_matric',
  deviceAnchor: 'campuscheck_device_anchor',
  offlineQueue: 'attendance_offline_queue',
  anchorCache: 'campuscheck_anchor_cache',
  activeSession: 'active_attendance_session',
  authToken: 'campuscheck_auth_token',
  portalUnlockedAt: 'campuscheck_portal_unlocked_at',
  checkinCount: 'campuscheck_checkin_count',
  feedLastSeen: 'campuscheck_feed_last_seen',
  pwaDismissCount: 'campuscheck_pwa_dismiss_count',
  pwaLastDismissedCheckinCount: 'campuscheck_pwa_last_dismissed_checkin_count',
  studentJwt: 'campuscheck_student_jwt',
} as const;

// ── Student status meme tiers ──
export const STREAK_TIERS = {
  odogwu: 10,
  consistent: 5,
  jjc: 1,
} as const;