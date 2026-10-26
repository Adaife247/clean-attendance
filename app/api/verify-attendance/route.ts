import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { RATE_LIMIT_DEFAULTS, GEOFENCE_RADIUS_METERS, GEOFENCE_HARD_BLOCK_METERS } from '@/utils/constants';

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
    // 1. Rate Limiting (20 attempts per minute per IP)
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

    // 2. Fetch Session using ADMIN client
    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code, expires_at, created_at, checkin_opens_after_minutes')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) return NextResponse.json({ message: "Invalid or expired session link." }, { status: 404 });
    if (session.is_active !== true) return NextResponse.json({ message: "Attendance window has been manually closed." }, { status: 403 });
    if (session.expires_at && new Date() > new Date(session.expires_at)) return NextResponse.json({ message: "Time's up. The attendance window has closed." }, { status: 403 });

    // 3. SERVER-SIDE ENFORCEMENT of the wait time
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

    // 4. Hard Reject: Enrollment Check
    const { data: courseRow } = await supabase.from('courses').select('id').eq('course_code', session.course_code).limit(1).maybeSingle();
    if (!courseRow) return NextResponse.json({ message: "Course configuration error." }, { status: 500 });

    const { data: enrollment } = await supabase.from('enrollments').select('id').eq('course_id', courseRow.id).eq('matric_number', cleanMatric).maybeSingle();
    if (!enrollment) return NextResponse.json({ message: `You are not registered for ${session.course_code}. Please contact your lecturer.` }, { status: 403 });

    // 5. Check for Existing Log
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog && existingLog.status === 'verified') {
      return NextResponse.json({ message: "You have already checked in to this session." }, { status: 409 });
    }

    // 6. Hard Reject: Proxy Check
    if (hardwareFingerprint && hardwareFingerprint !== 'unknown-hardware') {
      const { data: ghostLogs } = await supabase
        .from('attendance_logs')
        .select('matric_number')
        .eq('session_id', sessionId)
        .eq('device_hash', hardwareFingerprint)
        .eq('status', 'verified');

      if (ghostLogs && ghostLogs.length > 0) {
        return NextResponse.json({ status: 'rejected', message: "Security Block: This device has already been used for another student." }, { status: 403 });
      }
    }

    // 7. Geofence & Anomaly Check
    let isSpoofed = false;
    let bestPing = telemetry[0];

    for (let i = 0; i < telemetry.length; i++) {
      if (telemetry[i].acc < bestPing.acc) bestPing = telemetry[i];
    }

    let totalDrift = 0;
    for (let i = 1; i < telemetry.length; i++) {
      const drift = getDistanceInMeters(telemetry[i-1].lat, telemetry[i-1].lng, telemetry[i].lat, telemetry[i].lng);
      totalDrift += drift;
      const timeDeltaSec = Math.abs(telemetry[i].timestamp - telemetry[i-1].timestamp) / 1000;
      if (timeDeltaSec > 0 && drift / timeDeltaSec > 200) isSpoofed = true;
    }

    if (telemetry.length >= 3 && totalDrift < 0.5 && bestPing.acc === 0) isSpoofed = true;

    const distanceToLecturer = getDistanceInMeters(session.anchor_latitude, session.anchor_longitude, bestPing.lat, bestPing.lng);

    if (distanceToLecturer > GEOFENCE_HARD_BLOCK_METERS) {
      return NextResponse.json({ status: 'rejected', distance: Math.round(distanceToLecturer), message: "out of bounds" }, { status: 403 });
    }

    let finalStatus = 'absent';
    let responseMessage = `You are ${Math.round(distanceToLecturer)}m away (max: ${GEOFENCE_RADIUS_METERS}m).`;

    if (distanceToLecturer <= GEOFENCE_RADIUS_METERS) {
      if (isSpoofed) {
        finalStatus = 'flagged';
        responseMessage = "Location anomaly detected. Please see lecturer.";
      } else {
        finalStatus = 'verified';
        responseMessage = verificationMethod === 'skipped' ? "Verified via GPS (No Biometrics)" : "Verified";
      }
    }

    // 8. Insert or Update using ADMIN client
    if (existingLog) {
      await supabase.from('attendance_logs').update({
        status: finalStatus,
        device_info: JSON.stringify({ telemetry, evaluatedAccuracy: bestPing.acc, distanceMeters: Math.round(distanceToLecturer), deviceFingerprint, verificationMethod }),
        device_hash: hardwareFingerprint || 'unknown-hardware',
      }).eq('id', existingLog.id);
    } else {
      await supabase.from('attendance_logs').insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: finalStatus,
        device_info: JSON.stringify({ telemetry, evaluatedAccuracy: bestPing.acc, distanceMeters: Math.round(distanceToLecturer), deviceFingerprint, verificationMethod }),
        device_hash: hardwareFingerprint || 'unknown-hardware',
      }]);
    }

    return NextResponse.json({ status: finalStatus, distance: Math.round(distanceToLecturer), message: responseMessage }, { status: 200, headers: rateLimitHeaders(rateCheck) });

  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}