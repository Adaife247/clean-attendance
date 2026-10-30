import { describe, it, expect } from 'vitest';

// Copy of hashString from deviceFingerprint.ts
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

describe('hashString', () => {
  it('returns a 16-character hex string', () => {
    const h = hashString('hello');
    expect(h).toHaveLength(16);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    expect(hashString('campuscheck')).toBe(hashString('campuscheck'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('has low collision on typical fingerprints', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      hashes.add(hashString(`fingerprint-${i}`));
    }
    expect(hashes.size).toBe(1000);
  });
});