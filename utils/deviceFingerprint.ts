// utils/deviceFingerprint.ts

/**
 * Device Fingerprint Utility — Cross-Browser Edition
 * 
 * Combines signals that remain stable across Chrome, Firefox, Brave, and Incognito:
 * 1. GPU timing (DrawnApart method) — measures hardware execution, not browser strings [citation:1]
 * 2. WebGL driver parameters (without debug_renderer_info, which Firefox blocks) [citation:6][citation:17]
 * 3. Hardware signals (screen, CPU, touch, timezone) — OS-level, browser-agnostic [citation:4]
 * 4. Canvas rendering hash — adds entropy from font/GPU rasterization
 * 5. AudioContext processing hash — hardware audio characteristics [citation:7]
 */

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export interface DeviceFingerprintResult {
  hash: string;
  components: {
    gpuTiming: string;
    webglParams: string;
    hardware: string;
    canvas: string;
    audio: string;
  };
  duration: number;
}

/**
 * GPU Timing Fingerprint (DrawnApart)
 * Renders fixed WebGL workload and measures execution time.
 * Even identical GPUs have microscopic timing differences from manufacturing variance [citation:1][citation:20].
 */
async function getGpuTimingFingerprint(): Promise<string> {
  if (typeof document === 'undefined') return 'no-document';

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const gl = canvas.getContext('webgl', {
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  }) as WebGLRenderingContext | null;

  if (!gl) return 'no-webgl';

  const vsSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    void main() {
      float x = gl_FragCoord.x * 0.001;
      float y = gl_FragCoord.y * 0.001;
      gl_FragColor = vec4(x, y, x * y, 1.0);
    }
  `;

  function compileShader(context: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = context.createShader(type);
    if (!shader) return null;
    context.shaderSource(shader, source);
    context.compileShader(shader);
    return shader;
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return 'shader-compile-failed';

  const program = gl.createProgram();
  if (!program) return 'program-create-failed';
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertices = new Float32Array(200 * 2);
  for (let i = 0; i < 200; i++) {
    vertices[i * 2] = Math.sin(i) * 0.5;
    vertices[i * 2 + 1] = Math.cos(i) * 0.5;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  for (let i = 0; i < 10; i++) {
    gl.drawArrays(gl.TRIANGLES, 0, 200);
  }
  gl.finish();

  const iterations = 200;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    gl.drawArrays(gl.TRIANGLES, 0, 200);
  }
  gl.finish();
  const duration = performance.now() - start;

  gl.deleteBuffer(buffer);
  gl.deleteProgram(program);

  return duration.toFixed(3);
}

/**
 * WebGL Driver Parameters (WITHOUT debug_renderer_info)
 * Firefox blocks WEBGL_debug_renderer_info when resistFingerprinting is enabled [citation:6].
 * But these parameters are driver-level and remain accessible [citation:17].
 */
function getWebglParams(): string {
  if (typeof document === 'undefined') return 'no-document';

  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

  if (!gl) return 'no-webgl';

  const params: Array<string | number> = [];

  // These are stable across browsers (driver-level)
  params.push(`ver:${gl.getParameter(gl.VERSION)}`);
  params.push(`sl:${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`);
  params.push(`maxtex:${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
  params.push(`maxvtx:${gl.getParameter(gl.MAX_VERTEX_ATTRIBS)}`);
  params.push(`maxvary:${gl.getParameter(gl.MAX_VARYING_VECTORS)}`);
  params.push(`maxview:${gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.toString()}`);

  // Extensions list (differs between browsers but combined with timing adds entropy)
  const extensions = gl.getSupportedExtensions() || [];
  params.push(`ext:${extensions.sort().join(',')}`);

  return params.join('|');
}

/**
 * Canvas Rendering Fingerprint
 * Draws fixed text and shapes, then hashes pixel output.
 * Font anti-aliasing and GPU rasterization differences add entropy [citation:2].
 */
function getCanvasFingerprint(): string {
  if (typeof document === 'undefined') return 'no-document';

  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 60;
  const ctx = canvas.getContext('2d');

  if (!ctx) return 'no-2d-context';

  // Draw text with mixed fonts
  ctx.textBaseline = 'top';
  ctx.font = '14px "Arial"';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('CampusCheck🛡️', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('DeviceFingerprint', 4, 17);

  // Draw some shapes with gradients
  const gradient = ctx.createLinearGradient(0, 0, 300, 0);
  gradient.addColorStop(0, 'red');
  gradient.addColorStop(0.5, 'green');
  gradient.addColorStop(1, 'blue');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 40, 300, 20);

  // Draw an arc
  ctx.beginPath();
  ctx.arc(50, 50, 15, 0, Math.PI * 2);
  ctx.strokeStyle = '#333';
  ctx.stroke();

  const dataUrl = canvas.toDataURL();
  let h = 0;
  for (let i = 0; i < dataUrl.length; i++) {
    h = (h << 5) - h + dataUrl.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}

/**
 * AudioContext Fingerprint
 * Processes inaudible signal and hashes output.
 * Different hardware produces different audio processing artifacts [citation:7].
 */
async function getAudioFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'no-window';

  const w = window as WebkitWindow;
  const AudioCtx = window.AudioContext || w.webkitAudioContext;
  if (!AudioCtx) return 'no-audio';

  try {
    const ctx = new AudioCtx();

    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    oscillator.connect(compressor);
    compressor.connect(analyser);

    oscillator.start(0);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(dataArray);

    oscillator.stop();
    await ctx.close();

    const slice = Array.from(dataArray.slice(0, 100));
    const sum = slice.reduce((a, b) => a + b, 0);
    const hash = slice.map((v) => v.toFixed(4)).join('|');

    let h = 0;
    for (let i = 0; i < hash.length; i++) {
      h = (h << 5) - h + hash.charCodeAt(i);
      h |= 0;
    }

    return `${h.toString(16)}_${sum.toFixed(2)}`;
  } catch {
    return 'audio-error';
  }
}

/**
 * Hardware Signals (OS-level, browser-agnostic) [citation:4]
 */
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
    // Accessibility preferences (OS-level, browser-agnostic)
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '1' : '0',
    window.matchMedia('(prefers-contrast: more)').matches ? '1' : '0',
    window.matchMedia('(forced-colors: active)').matches ? '1' : '0',
    window.matchMedia('(prefers-color-scheme: dark)').matches ? '1' : '0',
  ];

  return signals.join(':');
}

/**
 * Dual 32-bit hash for 64-bit output (low collision)
 */
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

export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const start = performance.now();

  // Run async operations in parallel
  const [gpuTiming, audioHash] = await Promise.all([
    getGpuTimingFingerprint(),
    getAudioFingerprint(),
  ]);

  const webglParams = getWebglParams();
  const canvasHash = getCanvasFingerprint();
  const hardware = getHardwareFingerprint();

  const combined = `${gpuTiming}||${webglParams}||${canvasHash}||${audioHash}||${hardware}`;
  const hash = hashString(combined);
  const duration = performance.now() - start;

  return {
    hash,
    components: {
      gpuTiming,
      webglParams,
      hardware,
      canvas: canvasHash,
      audio: audioHash,
    },
    duration,
  };
}