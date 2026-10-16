import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GEOFENCE_RADIUS_METERS = 250;
const HARD_BLOCK_METERS = 500;

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await request.json();
    const { sessionId, matricNumber, telemetry, hardwareFingerprint } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!sessionId || !cleanMatric || !telemetry || telemetry.length === 0) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code, expires_at, created_at, checkin_opens_after_minutes')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ message: "Invalid or expired session link." }, { status: 404 });
    }

    if (session.is_active !== true) {
      return NextResponse.json({ message: "Attendance window has been manually closed." }, { status: 403 });
    }

    if (session.expires_at && new Date() > new Date(session.expires_at)) {
      return NextResponse.json({ message: "Time's up. The attendance window has closed." }, { status: 403 });
    }

    const opensAfter = session.checkin_opens_after_minutes ?? 10;

    if (opensAfter > 0 && session.created_at) {
      const sessionStart = new Date(session.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - sessionStart) / 60000;

      if (elapsedMinutes < opensAfter) {
        const remaining = Math.ceil(opensAfter - elapsedMinutes);
        return NextResponse.json({
          message: `Attendance opens in ${remaining} minute${remaining === 1 ? '' : 's'}. Wait until the lecture has started.`
        }, { status: 403 });
      }
    }

    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog) {
      return NextResponse.json({ message: "You have already checked in to this session." }, { status: 409 });
    }

    if (hardwareFingerprint && hardwareFingerprint !== 'unknown-hardware') {
      const { data: ghostLogs } = await supabase
        .from('attendance_logs')
        .select('matric_number')
        .eq('session_id', sessionId)
        .eq('device_hash', hardwareFingerprint);

      if (ghostLogs && ghostLogs.length > 0) {
        await supabase.from('attendance_logs').insert([{
          session_id: sessionId,
          matric_number: cleanMatric,
          status: 'flagged',
          device_info: JSON.stringify({ telemetry, reason: `Proxy Match with ${ghostLogs[0].matric_number}` }),
          device_hash: hardwareFingerprint
        }]);
        return NextResponse.json({
          status: 'flagged',
          distance: 0,
          message: "Security Block: Multiple check-ins detected from identical hardware specs."
        }, { status: 200 });
      }
    }

    // ─── Anomaly detection ───
    // We only flag two things that are physically impossible / highly suspicious:
    //   1. Movement faster than 200 m/s (720 km/h) between consecutive pings
    //   2. Reported accuracy < 3m — real GPS never reports sub-3m indoors/outdoors
    // Everything else (standing still, no altitude, weird accuracy) is normal
    // Android behaviour indoors and must NOT be flagged.
    let isSpoofed = false;
    let bestPing = telemetry[0];

    for (let i = 0; i < telemetry.length; i++) {
      const ping = telemetry[i];
      if (ping.acc < bestPing.acc) bestPing = ping;
    }

    // Suspiciously perfect accuracy
    if (bestPing.acc < 3) {
      isSpoofed = true;
    }

    // Impossible movement between consecutive pings
    for (let i = 1; i < telemetry.length; i++) {
      const prev = telemetry[i - 1];
      const curr = telemetry[i];
      const drift = getDistanceInMeters(prev.lat, prev.lng, curr.lat, curr.lng);
      const timeDeltaSec = Math.abs(curr.timestamp - prev.timestamp) / 1000;

      if (timeDeltaSec > 0 && drift / timeDeltaSec > 200) {
        isSpoofed = true;
      }
    }

    const distanceToLecturer = getDistanceInMeters(
      session.anchor_latitude,
      session.anchor_longitude,
      bestPing.lat,
      bestPing.lng
    );

    if (distanceToLecturer > HARD_BLOCK_METERS) {
      return NextResponse.json({
        status: 'rejected',
        distance: Math.round(distanceToLecturer),
        message: "out of bounds"
      }, { status: 403 });
    }

    let finalStatus = 'absent';
    let responseMessage = `You are ${Math.round(distanceToLecturer)}m away (max: ${GEOFENCE_RADIUS_METERS}m).`;

    if (distanceToLecturer <= GEOFENCE_RADIUS_METERS) {
      if (isSpoofed) {
        finalStatus = 'flagged';
        responseMessage = "Location anomaly detected. Please see lecturer.";
      } else {
        finalStatus = 'verified';
        responseMessage = "Verified";
      }
    }

    await supabase.from('attendance_logs').insert([{
      session_id: sessionId,
      matric_number: cleanMatric,
      status: finalStatus,
      device_info: JSON.stringify({
        telemetry,
        evaluatedAccuracy: bestPing.acc,
        distanceMeters: Math.round(distanceToLecturer),
        spoofReasons: isSpoofed ? ['see_server_logs'] : []
      }),
      device_hash: hardwareFingerprint || 'unknown-hardware'
    }]);

    return NextResponse.json({
      status: finalStatus,
      distance: Math.round(distanceToLecturer),
      message: responseMessage
    }, { status: 200 });

  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}