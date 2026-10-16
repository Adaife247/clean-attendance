// utils/deviceFingerprint.ts

/**
 * Device Fingerprint Utility
 * 
 * Stable-across-incognito fingerprint built from hardware-stable signals:
 * - WebGL renderer + vendor strings (GPU model)
 * - Screen dimensions + DPR
 * - CPU cores, touch points, platform
 * - Timezone
 * 
 * Deliberately EXCLUDES signals that change between normal/incognito:
 * - GPU timing
 * - AudioContext processing
 * - deviceMemory (often masked)
 * - vendor (often spoofed)
 */

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export interface DeviceFingerprintResult {
  hash: string;
  components: {
    gpu: string;
    screen: string;
    hardware: string;
  };
  duration: number;
}

function getGpuInfo(): string {
  if (typeof document === 'undefined') return 'no-document';

  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

  if (!gl) return 'no-webgl';

  const parts: string[] = [];

  // Unmasked renderer + vendor (the good stuff)
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    parts.push(`r:${renderer}`);
    parts.push(`v:${vendor}`);
  } else {
    // Fallback: masked values (less unique, but better than nothing)
    parts.push(`r:${gl.getParameter(gl.RENDERER)}`);
    parts.push(`v:${gl.getParameter(gl.VENDOR)}`);
  }

  // WebGL parameters that are stable per GPU/driver
  parts.push(`ver:${gl.getParameter(gl.VERSION)}`);
  parts.push(`sl:${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`);
  parts.push(`maxtex:${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
  parts.push(`maxvp:${gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.toString()}`);
  parts.push(`maxvtx:${gl.getParameter(gl.MAX_VERTEX_ATTRIBS)}`);
  parts.push(`maxvary:${gl.getParameter(gl.MAX_VARYING_VECTORS)}`);

  // Extensions list — very stable per GPU/driver combo
  const extensions = gl.getSupportedExtensions() || [];
  parts.push(`ext:${extensions.sort().join(',')}`);

  return parts.join('|');
}

function getScreenInfo(): string {
  if (typeof window === 'undefined') return 'no-window';
  const s = window.screen;
  return [
    s.width,
    s.height,
    s.availWidth,
    s.availHeight,
    s.colorDepth,
    s.pixelDepth,
    window.devicePixelRatio || 1,
  ].join(':');
}

function getHardwareInfo(): string {
  if (typeof window === 'undefined') return 'no-window';
  const nav = navigator as NavigatorWithMemory;

  return [
    nav.hardwareConcurrency || 0,
    nav.maxTouchPoints || 0,
    nav.platform || 'unknown',
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    // Note: intentionally NOT including nav.vendor, nav.language, deviceMemory,
    // or prefers-* media queries — these change in incognito
  ].join(':');
}

function hashString(str: string): string {
  // Use two 32-bit hashes for a 64-bit result (less collision risk)
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

export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const start = performance.now();

  const gpu = getGpuInfo();
  const screen = getScreenInfo();
  const hardware = getHardwareInfo();

  const combined = `${gpu}||${screen}||${hardware}`;
  const hash = hashString(combined);
  const duration = performance.now() - start;

  return {
    hash,
    components: { gpu, screen, hardware },
    duration,
  };
}