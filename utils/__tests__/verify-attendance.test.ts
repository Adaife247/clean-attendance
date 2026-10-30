import { describe, it, expect } from 'vitest';

// Copy of pure functions from app/api/verify-attendance/route.ts
interface Telemetry { lat: number; lng: number; alt: number | null; acc: number; timestamp: number; }

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getValidPings(telemetry: Telemetry[]): Telemetry[] {
  return (telemetry || []).filter((t) => {
    if (typeof t.lat !== 'number' || typeof t.lng !== 'number') return false;
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) return false;
    if (Math.abs(t.lat) < 0.0001 && Math.abs(t.lng) < 0.0001) return false;
    if (typeof t.acc !== 'number') return false;
    if (t.acc < 0) return false;
    if (t.acc > 2000) return false;
    return true;
  });
}

function detectLikelySpoof(pings: Telemetry[]): boolean {
  const accurate = pings.filter(t => t.acc > 0 && t.acc <= 50);
  if (accurate.length < 4) return false;
  let anomalousJumps = 0;
  for (let i = 1; i < accurate.length; i++) {
    const drift = getDistanceInMeters(accurate[i - 1].lat, accurate[i - 1].lng, accurate[i].lat, accurate[i].lng);
    const dt = Math.abs(accurate[i].timestamp - accurate[i - 1].timestamp) / 1000;
    if (dt > 0 && dt < 2 && drift / dt > 200) anomalousJumps++;
  }
  return anomalousJumps >= 3;
}

describe('getDistanceInMeters', () => {
  it('returns 0 for the same point', () => {
    expect(getDistanceInMeters(6.5, 3.3, 6.5, 3.3)).toBe(0);
  });

  it('calculates the distance between Lagos and Abuja (~535km)', () => {
    const dist = getDistanceInMeters(6.5244, 3.3792, 9.0765, 7.3986);
    expect(dist).toBeGreaterThan(500_000);
    expect(dist).toBeLessThan(600_000);
  });
});

describe('getValidPings', () => {
  const goodPing = { lat: 6.5, lng: 3.3, alt: 10, acc: 5, timestamp: Date.now() };

  it('accepts a good ping', () => {
    expect(getValidPings([goodPing])).toHaveLength(1);
  });

  it('rejects null island (0,0)', () => {
    expect(getValidPings([{ ...goodPing, lat: 0, lng: 0 }])).toHaveLength(0);
  });

  it('rejects non-finite coordinates', () => {
    expect(getValidPings([{ ...goodPing, lat: NaN }])).toHaveLength(0);
    expect(getValidPings([{ ...goodPing, lng: Infinity }])).toHaveLength(0);
  });

  it('rejects negative accuracy', () => {
    expect(getValidPings([{ ...goodPing, acc: -1 }])).toHaveLength(0);
  });

  it('rejects accuracy > 2000 (GPS failure)', () => {
    expect(getValidPings([{ ...goodPing, acc: 5000 }])).toHaveLength(0);
  });
});

describe('detectLikelySpoof', () => {
  const baseTime = Date.now();

  it('returns false for stationary readings', () => {
    const pings = [0, 1, 2, 3].map(i => ({
      lat: 6.5, lng: 3.3, alt: 10, acc: 5, timestamp: baseTime + i * 1000,
    }));
    expect(detectLikelySpoof(pings)).toBe(false);
  });

  it('returns true for teleporting readings (mock GPS)', () => {
    const pings = [
      { lat: 6.5, lng: 3.3, alt: 10, acc: 5, timestamp: baseTime + 0 },
      { lat: 6.6, lng: 3.4, alt: 10, acc: 5, timestamp: baseTime + 500 }, // ~14km in 0.5s
      { lat: 6.5, lng: 3.3, alt: 10, acc: 5, timestamp: baseTime + 1000 },
      { lat: 6.6, lng: 3.4, alt: 10, acc: 5, timestamp: baseTime + 1500 },
    ];
    expect(detectLikelySpoof(pings)).toBe(true);
  });
});