// app/api/verify-attendance/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { RATE_LIMIT_DEFAULTS, GEOFENCE_RADIUS_METERS, GEOFENCE_HARD_BLOCK_METERS } from '@/utils/constants';

interface Telemetry {
  lat: number;
  lng: number;
  alt: number | null;
  acc: number;
  timestamp: number;
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Returns only telemetry pings that are physically plausible.
 * Rejects null-island coordinates and absurd accuracy values.
 * A ping with acc=0 is "unknown accuracy" and is accepted (many Android
 * devices report 0 rather than null when accuracy isn't available).
 * A ping with acc>2000 is considered garbage (GPS failure).
 */
function getValidPings(telemetry: Telemetry[]): Telemetry[] {
  return (telemetry || []).filter((t) => {
    if (typeof t.lat !== 'number' || typeof t.lng !== 'number') return false;
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) return false;
    if (Math.abs(t.lat) < 0.0001 && Math.abs(t.lng) < 0.0001) return false; // null island
    if (typeof t.acc !== 'number') return false;
    if (t.acc < 0) return false;
    if (t.acc > 2000) return false;
    return true;
  });
}

/**
 * Conservative spoof detection. Requires at least 3 anomalous jumps
 * between pings that are (a) accurate, (b) close in time.
 * Returns true only when the pattern is unambiguous.
 * Even when true, callers must NOT disqualify — only flag.
 */
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

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = RATE_LIMIT_DEFAULTS['verify-attendance'];
    const rateCheck = await checkRateLimit(`verify-att:${ip}`, limit);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { status: 'failed', message: "Too many attempts. Please wait a minute and try again." },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const body = await request.json();
    const { sessionId, matricNumber, telemetry, deviceFingerprint, verificationMethod, userAgent } = body;

    if (!matricNumber || !sessionId) {
      return NextResponse.json({ status: 'failed', message: "Invalid request. Refresh the page and try again." }, { status: 400 });
    }

    const isIOS = /iPad|iPhone|iPod/.test(userAgent || '');
    const cleanMatric = matricNumber.toUpperCase().trim();

    const validPings = getValidPings(telemetry);

    if (validPings.length === 0) {
      // 200 not 400: this is a legitimate "GPS hasn't fired yet" case.
      return NextResponse.json({
        status: 'failed',
        message: "No usable GPS reading was received. Keep Location on, move near a window, and try again in 5 seconds.",
        distance: null,
        maxAllowedDistance: GEOFENCE_RADIUS_METERS,
      }, { status: 200, headers: rateLimitHeaders(rateCheck) });
    }

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, anchor_ip, is_active, course_code, expires_at, created_at, checkin_opens_after_minutes')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ status: 'failed', message: "This check-in link is no longer valid." }, { status: 404 });
    }
    if (session.is_active !== true) {
      return NextResponse.json({ status: 'failed', message: "Attendance for this class has been closed." }, { status: 403 });
    }
    if (session.expires_at && new Date() > new Date(session.expires_at)) {
      return NextResponse.json({ status: 'failed', message: "Time is up. The attendance window has closed." }, { status: 403 });
    }

    const opensAfter = session.checkin_opens_after_minutes ?? 10;
    if (opensAfter > 0 && session.created_at) {
      const sessionStart = new Date(session.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - sessionStart) / 60000;
      if (elapsedMinutes < opensAfter) {
        const remaining = Math.ceil(opensAfter - elapsedMinutes);
        return NextResponse.json({
          status: 'failed',
          message: `Attendance opens in ${remaining} minute${remaining === 1 ? '' : 's'}.`
        }, { status: 403 });
      }
    }

    const { data: courseRow } = await supabase.from('courses').select('id').eq('course_code', session.course_code).limit(1).maybeSingle();
    if (!courseRow) {
      return NextResponse.json({ status: 'failed', message: "Course configuration error. Contact your lecturer." }, { status: 500 });
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', courseRow.id)
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({
        status: 'failed',
        message: `You are not registered for ${session.course_code}. Contact your lecturer.`
      }, { status: 403 });
    }

    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, status, device_info')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog && existingLog.status === 'verified') {
      return NextResponse.json({ status: 'verified', message: "You have already checked in to this session." }, { status: 200 });
    }

    // ── Compute best distance from anchor ──
    let bestDistance = Infinity;
    let bestAccuracy: number | null = null;
    for (const ping of validPings) {
      const dist = getDistanceInMeters(session.anchor_latitude, session.anchor_longitude, ping.lat, ping.lng);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestAccuracy = ping.acc > 0 ? ping.acc : bestAccuracy;
      }
    }

    // ── Radius: expand slightly when the GPS reading itself is weak ──
    // Replaces the previous UA-based iOS bump with an accuracy-based one.
    const isWeakSignal = bestAccuracy !== null && bestAccuracy > 100;
    const allowedRadius = isWeakSignal ? 500 : GEOFENCE_RADIUS_METERS;
    const hardBlockRadius = isWeakSignal ? 1000 : GEOFENCE_HARD_BLOCK_METERS;

    // ── Soft spoof signal: flag, never disqualify ──
    const spoofSuspected = detectLikelySpoof(validPings);

    // ── IP shortcut: same network as the lecturer means "in the room" ──
    const isOnSameNetwork = session.anchor_ip && session.anchor_ip === ip;

    let finalStatus = 'absent';
    let responseMessage = `You are ${Math.round(bestDistance)}m from the class anchor (allowed: ${allowedRadius}m).`;

    if (isOnSameNetwork || bestDistance <= allowedRadius) {
      if (spoofSuspected) {
        finalStatus = 'flagged';
        responseMessage = "You're close enough, but your location signal was unstable. Your lecturer will review this.";
      } else {
        finalStatus = 'verified';
        responseMessage = isOnSameNetwork
          ? "Verified via campus Wi-Fi."
          : (verificationMethod === 'skipped'
              ? "Verified via GPS (biometrics skipped)."
              : "Verified.");
      }
    } else if (bestDistance > hardBlockRadius) {
      finalStatus = 'flagged';
      responseMessage = `You are ${Math.round(bestDistance)}m from the class anchor. You must be inside the lecture hall (allowed: ${allowedRadius}m).`;
    } else {
      finalStatus = 'flagged';
      responseMessage = `You are ${Math.round(bestDistance)}m from the class anchor (allowed: ${allowedRadius}m). Move closer and try again.`;
    }

    // ── If this student was previously disqualified, do NOT block them ──
    // A disqualification from GPS instability is not a valid reason to
    // permanently lock a student out. We re-evaluate every attempt.
    // (The only hard disqualification source — proxy-device-reuse — has been
    // removed because the client never supplied the required data.)

    const deviceInfoPayload = JSON.stringify({
      telemetry: validPings,
      evaluatedDistance: Math.round(bestDistance),
      distanceMeters: Math.round(bestDistance),
      bestAccuracy,
      deviceFingerprint,
      verificationMethod,
      spoofSuspected,
      isOnSameNetwork,
      isIOS,
    });

    if (existingLog) {
      await supabase.from('attendance_logs').update({
        status: finalStatus,
        device_info: deviceInfoPayload,
        device_hash: deviceFingerprint || 'unknown-hardware',
      }).eq('id', existingLog.id);
    } else {
      await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: finalStatus,
        device_info: deviceInfoPayload,
        device_hash: deviceFingerprint || 'unknown-hardware',
      }]);
    }

    return NextResponse.json({
      status: finalStatus,
      distance: Math.round(bestDistance),
      accuracy: bestAccuracy,
      maxAllowedDistance: allowedRadius,
      message: responseMessage,
    }, { status: 200, headers: rateLimitHeaders(rateCheck) });

  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json({ status: 'failed', message: "Server error. Please try again." }, { status: 500 });
  }
}