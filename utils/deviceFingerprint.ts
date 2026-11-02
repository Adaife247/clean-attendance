// utils/deviceFingerprint.ts

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export interface DeviceFingerprintResult {
  hash: string;        // The combined hardware + UUID hash
  deviceId: string;    // The persistent UUID (for the server)
  components: {
    hardware: string;
    deviceId: string;
  };
  duration: number;
}

function getHardwareFingerprint(): string {
  if (typeof window === 'undefined') return 'no-window';

  const nav = navigator as NavigatorWithMemory;
  const screen = window.screen;

  const signals: Array<string | number> = [
    screen.width,
    screen.height,
    screen.availWidth,
    screen.availHeight,
    screen.colorDepth,
    screen.pixelDepth,
    window.devicePixelRatio || 1,
    nav.hardwareConcurrency || 0,
    nav.maxTouchPoints || 0,
    nav.platform || 'unknown',
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '1' : '0',
    window.matchMedia('(prefers-color-scheme: dark)').matches ? '1' : '0',
  ];

  return signals.join(':');
}

function hashString(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h1 ^= char;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= char;
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return p1 + p2;
}

function getLocalDeviceId(): string {
  if (typeof window === 'undefined') return 'no-window';
  
  const STORAGE_KEY = 'campuscheck_local_device_id';
  let id = window.localStorage.getItem(STORAGE_KEY);
  
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const start = performance.now();

  const hardware = getHardwareFingerprint();
  const deviceId = getLocalDeviceId();
  
  const combined = `${hardware}||${deviceId}`;
  const hash = hashString(combined);
  
  const duration = performance.now() - start;

  return {
    hash,
    deviceId,
    components: {
      hardware,
      deviceId,
    },
    duration,
  };
}