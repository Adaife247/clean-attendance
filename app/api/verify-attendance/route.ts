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

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = RATE_LIMIT_DEFAULTS['verify-attendance'];
    const rateCheck = checkRateLimit(`verify-att:${ip}`, limit);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please wait a minute." },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const body = await request.json();
    const { sessionId, matricNumber, telemetry, hardwareFingerprint, deviceFingerprint, verificationMethod } = body;
    
    if (!matricNumber || !sessionId) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!telemetry || telemetry.length === 0) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code, expires_at, created_at, checkin_opens_after_minutes')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) return NextResponse.json({ message: "Invalid or expired session link." }, { status: 404 });
    if (session.is_active !== true) return NextResponse.json({ message: "Attendance window has been manually closed." }, { status: 403 });
    if (session.expires_at && new Date() > new Date(session.expires_at)) return NextResponse.json({ message: "Time's up. The attendance window has closed." }, { status: 403 });

    const opensAfter = session.checkin_opens_after_minutes ?? 10;
    if (opensAfter > 0 && session.created_at) {
      const sessionStart = new Date(session.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - sessionStart) / 60000;
      if (elapsedMinutes < opensAfter) {
        const remaining = Math.ceil(opensAfter - elapsedMinutes);
        return NextResponse.json({ message: `Attendance opens in ${remaining} minute${remaining === 1 ? '' : 's'}. Wait until the lecture has started.` }, { status: 403 });
      }
    }

    const { data: courseRow } = await supabase.from('courses').select('id').eq('course_code', session.course_code).limit(1).maybeSingle();
    if (!courseRow) return NextResponse.json({ message: "Course configuration error." }, { status: 500 });

    const { data: enrollment } = await supabase.from('enrollments').select('id').eq('course_id', courseRow.id).eq('matric_number', cleanMatric).maybeSingle();
    if (!enrollment) return NextResponse.json({ message: `You are not registered for ${session.course_code}. Please contact your lecturer.` }, { status: 403 });

    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, status, device_info')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog && existingLog.status === 'verified') {
      return NextResponse.json({ message: "You have already checked in to this session." }, { status: 409 });
    }

    let disqualificationReason: string | null = null;

    if (hardwareFingerprint && hardwareFingerprint !== 'unknown-hardware') {
      const { data: ghostLogs } = await supabase
        .from('attendance_logs')
        .select('matric_number')
        .eq('session_id', sessionId)
        .eq('device_hash', hardwareFingerprint)
        .eq('status', 'verified');

      if (ghostLogs && ghostLogs.length > 0) {
        disqualificationReason = 'proxy-device-reuse';
      }
    }

    let isSpoofed = false;
    
    // FILTER: Remove any pings with 0 accuracy. This is an iOS glitch, not a real location.
    const validPings = (telemetry as Telemetry[]).filter((t: Telemetry) => t.acc > 0);
    
    // If all pings were 0, default to the raw telemetry so we don't crash
    const pingsToUse = validPings.length > 0 ? validPings : telemetry;

    let bestPing = pingsToUse[0];
    for (let i = 0; i < pingsToUse.length; i++) {
      if (pingsToUse[i].acc < bestPing.acc) bestPing = pingsToUse[i];
    }

    // Check for teleportation (spoofing)
    for (let i = 1; i < pingsToUse.length; i++) {
      const drift = getDistanceInMeters(pingsToUse[i-1].lat, pingsToUse[i-1].lng, pingsToUse[i].lat, pingsToUse[i].lng);
      const timeDeltaSec = Math.abs(pingsToUse[i].timestamp - pingsToUse[i-1].timestamp) / 1000;
      if (timeDeltaSec > 0 && drift / timeDeltaSec > 200) isSpoofed = true;
    }

    if (isSpoofed) {
      disqualificationReason = 'gps-spoof-pattern';
    }

    const distanceToLecturer = getDistanceInMeters(session.anchor_latitude, session.anchor_longitude, bestPing.lat, bestPing.lng);

    let finalStatus = 'absent';
    let responseMessage = `You are ${Math.round(distanceToLecturer)}m away (max: ${GEOFENCE_RADIUS_METERS}m).`;

    // THE FORGIVING GEOFENCE
    const accuracyMargin = bestPing.acc || 0;
    const isInsideGeofence = distanceToLecturer <= GEOFENCE_RADIUS_METERS || (distanceToLecturer - accuracyMargin) <= GEOFENCE_RADIUS_METERS;

    if (disqualificationReason) {
      finalStatus = 'disqualified';
      responseMessage = "This attempt has been flagged as invalid. Please see your lecturer in person.";
    } else if (isInsideGeofence) {
      finalStatus = 'verified';
      responseMessage = verificationMethod === 'skipped' ? "Verified via GPS (No Biometrics)" : "Verified";
    } else if (distanceToLecturer > GEOFENCE_HARD_BLOCK_METERS) {
      finalStatus = 'flagged';
      responseMessage = "You are too far from the lecture hall.";
    } else {
      finalStatus = 'flagged';
      responseMessage = `You are ${Math.round(distanceToLecturer)}m away. You must be inside the lecture hall.`;
    }

    if (existingLog) {
      if (existingLog.status === 'disqualified') {
        finalStatus = 'disqualified';
        responseMessage = "This attempt was previously disqualified. See your lecturer in person.";
      } else {
        try {
          const prevInfo = existingLog.device_info ? JSON.parse(existingLog.device_info) : {};
          if (prevInfo.disqualificationReason) {
            finalStatus = 'disqualified';
            responseMessage = "This attempt was previously disqualified. See your lecturer in person.";
          }
        } catch {}
      }
    }

    const deviceInfoPayload = JSON.stringify({ 
      telemetry, 
      evaluatedAccuracy: bestPing.acc, 
      distanceMeters: Math.round(distanceToLecturer), 
      deviceFingerprint, 
      verificationMethod,
      disqualificationReason
    });

    if (existingLog) {
      await supabase.from('attendance_logs').update({
        status: finalStatus,
        device_info: deviceInfoPayload,
        device_hash: hardwareFingerprint || 'unknown-hardware',
      }).eq('id', existingLog.id);
    } else {
      await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: finalStatus,
        device_info: deviceInfoPayload,
        device_hash: hardwareFingerprint || 'unknown-hardware',
      }]);
    }

    return NextResponse.json({ status: finalStatus, distance: Math.round(distanceToLecturer), message: responseMessage }, { status: 200, headers: rateLimitHeaders(rateCheck) });

  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}