// utils/deviceFingerprint.ts

/**
 * Device Fingerprint Utility
 * Combines research-backed signals to create a cross-browser device identifier.
 */

// Narrow types for browser APIs not in standard TS lib
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
    audioHash: string;
    hardware: string;
  };
  duration: number;
}

/**
 * GPU Timing Fingerprint (DrawnApart)
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
  });

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

  function compileShader(
    context: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
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
 * AudioContext Fingerprint
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
 * Hardware Signals Fingerprint
 */
function getHardwareFingerprint(): string {
  if (typeof window === 'undefined') return 'no-window';

  const nav = navigator as NavigatorWithMemory;
  const screen = window.screen;

  const signals: Array<string | number> = [
    screen.width,
    screen.height,
    screen.colorDepth,
    screen.pixelDepth,
    window.devicePixelRatio || 1,
    nav.hardwareConcurrency || 0,
    nav.deviceMemory || 0,
    nav.maxTouchPoints || 0,
    nav.platform || 'unknown',
    nav.vendor || 'unknown',
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    nav.language || 'unknown',
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '1' : '0',
    window.matchMedia('(prefers-contrast: more)').matches ? '1' : '0',
    window.matchMedia('(forced-colors: active)').matches ? '1' : '0',
  ];

  return signals.join(':');
}

function hashString(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h = (h << 5) - h + char;
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(16, '0');
}

export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const start = performance.now();

  const [gpuTiming, audioHash] = await Promise.all([
    getGpuTimingFingerprint(),
    getAudioFingerprint(),
  ]);

  const hardware = getHardwareFingerprint();
  const combined = `${gpuTiming}||${audioHash}||${hardware}`;
  const hash = hashString(combined);
  const duration = performance.now() - start;

  return {
    hash,
    components: { gpuTiming, audioHash, hardware },
    duration,
  };
}