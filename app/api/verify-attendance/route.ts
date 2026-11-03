// app/api/verify-attendance/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/utils/rate-limit';
import { 
  RATE_LIMIT_DEFAULTS, 
  GEOFENCE_RADIUS_METERS, 
  GEOFENCE_INDOOR_RADIUS_METERS, 
  GPS_WEAK_SIGNAL_THRESHOLD,
  GEOFENCE_HARD_BLOCK_METERS
} from '@/utils/constants';
import { verifyStudentToken } from '@/utils/student-auth';
import { FLAG_REASONS } from '@/utils/flag-reasons';

interface Telemetry {
  lat: number;
  lng: number;
  alt: number | null;
  acc: number;
  timestamp: number;
}

interface AuditLogPayload {
  session_id: string;
  matric_number: string;
  outcome: 'failed' | 'verified' | 'flagged' | 'blocked';
  reason_code: string | null;
  reason_detail: Record<string, unknown> | null;
  ip_address: string;
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

    // Require the student JWT
    const auth = verifyStudentToken(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { sessionId, telemetry, hardwareFingerprint, verificationMethod, userAgent } = body;

    const cleanMatric = auth.matric!;
    const credentialId = auth.credentialId!;

    if (!sessionId || !hardwareFingerprint) {
      return NextResponse.json({ status: 'failed', message: "Invalid request. Refresh the page and try again." }, { status: 400 });
    }

    // Initialize audit log payload
        // Initialize audit log payload
    const auditLogPayload: AuditLogPayload = {
      session_id: sessionId,
      matric_number: cleanMatric,
      outcome: 'failed',
      reason_code: null,
      reason_detail: null,
      ip_address: ip
    };

    // CRITICAL: Enforce biometrics.
    if (verificationMethod !== 'biometric') {
      auditLogPayload.reason_code = 'NO_BIOMETRIC';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({
        status: 'failed',
        message: "Biometric verification is required to check in."
      }, { status: 403 });
    }

    const isIOS = /iPad|iPhone|iPod/.test(userAgent || '');
    const validPings = getValidPings(telemetry);

    if (validPings.length === 0) {
      auditLogPayload.reason_code = 'GPS_WEAK';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({
        status: 'failed',
        message: FLAG_REASONS.GPS_WEAK.messageStudent,
        distance: null,
        maxAllowedDistance: GEOFENCE_RADIUS_METERS,
      }, { status: 200, headers: rateLimitHeaders(rateCheck) });
    }

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code, expires_at, created_at, checkin_opens_after_minutes')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      auditLogPayload.reason_code = 'INVALID_SESSION';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({ status: 'failed', message: "This check-in link is no longer valid." }, { status: 404 });
    }
    if (session.is_active !== true) {
      auditLogPayload.reason_code = 'SESSION_CLOSED';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({ status: 'failed', message: "Attendance for this class has been closed." }, { status: 403 });
    }
    if (session.expires_at && new Date() > new Date(session.expires_at)) {
      auditLogPayload.reason_code = 'SESSION_EXPIRED';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({ status: 'failed', message: "Time is up. The attendance window has closed." }, { status: 403 });
    }

    const opensAfter = session.checkin_opens_after_minutes ?? 10;
    if (opensAfter > 0 && session.created_at) {
      const sessionStart = new Date(session.created_at).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - sessionStart) / 60000;
      if (elapsedMinutes < opensAfter) {
        const remaining = Math.ceil(opensAfter - elapsedMinutes);
        auditLogPayload.reason_code = 'OPENS_LATER';
        await supabase.from('checkin_attempts').insert(auditLogPayload);
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
      auditLogPayload.reason_code = 'NOT_ENROLLED';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({
        status: 'failed',
        message: `You are not registered for ${session.course_code}. Contact your lecturer.`
      }, { status: 403 });
    }

    // ─── PROXY PREVENTION 1: CREDENTIAL BINDING ───
    // Check if the hardware fingerprint matches the one used at registration
    const { data: registeredDevice } = await supabase
      .from('user_devices')
      .select('hardware_fingerprint')
      .eq('credential_id', credentialId)
      .single();

    if (registeredDevice && registeredDevice.hardware_fingerprint !== hardwareFingerprint) {
      auditLogPayload.reason_code = 'SYNCED_PASSKEY';
      auditLogPayload.outcome = 'flagged';
      auditLogPayload.reason_detail = { registered_fingerprint: registeredDevice.hardware_fingerprint, current_fingerprint: hardwareFingerprint };
      
      // We flag this, but allow them to proceed (to avoid blocking legit phone upgrades).
      // The lecturer will see the flag in the dashboard.
    }

    // ─── PROXY PREVENTION 2: THE CHECK-IN TRAP (SAME DEVICE, DIFFERENT STUDENT) ───
    // Check if this exact physical hardware has already checked in for someone else in this session.
    const { data: existingSessionLogs } = await supabase
      .from('attendance_logs')
      .select('matric_number, device_info')
      .eq('session_id', sessionId);

    if (existingSessionLogs && existingSessionLogs.length > 0) {
      const proxyAttempt = existingSessionLogs.find(log => {
        if (log.matric_number === cleanMatric) return false;
        try {
          const info = JSON.parse(log.device_info || '{}');
          return info.hardwareFingerprint === hardwareFingerprint;
        } catch {
          return false;
        }
      });

      if (proxyAttempt) {
        auditLogPayload.reason_code = 'SAME_DEVICE_TODAY';
        auditLogPayload.outcome = 'blocked';
        auditLogPayload.reason_detail = { attempted_matric: cleanMatric, already_checked_in_matric: proxyAttempt.matric_number };
        await supabase.from('checkin_attempts').insert(auditLogPayload);

        return NextResponse.json({
          status: 'blocked',
          message: FLAG_REASONS.SAME_DEVICE_TODAY.messageStudent
        }, { status: 403 });
      }
    }

    // Check if this student already has a verified log for this session
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog && existingLog.status === 'verified') {
      auditLogPayload.outcome = 'verified';
      auditLogPayload.reason_code = 'ALREADY_VERIFIED';
      await supabase.from('checkin_attempts').insert(auditLogPayload);
      return NextResponse.json({ status: 'verified', message: "You have already checked in to this session." }, { status: 200 });
    }

    // ─── GPS & GEOFENCE LOGIC (No IP AUTO-VERIFY) ───
    let bestDistance = Infinity;
    let bestAccuracy: number | null = null;
    for (const ping of validPings) {
      const dist = getDistanceInMeters(session.anchor_latitude, session.anchor_longitude, ping.lat, ping.lng);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestAccuracy = ping.acc > 0 ? ping.acc : bestAccuracy;
      }
    }

    const isWeakSignal = bestAccuracy === null || bestAccuracy > GPS_WEAK_SIGNAL_THRESHOLD;
    const allowedRadius = isWeakSignal ? GEOFENCE_INDOOR_RADIUS_METERS : GEOFENCE_RADIUS_METERS;
    const hardBlockRadius = isWeakSignal ? (GEOFENCE_INDOOR_RADIUS_METERS + 500) : GEOFENCE_HARD_BLOCK_METERS;

    const spoofSuspected = detectLikelySpoof(validPings);

        let finalStatus: 'verified' | 'flagged' = 'flagged';
    let responseMessage = `You are ${Math.round(bestDistance)}m from the class anchor (allowed: ${allowedRadius}m).`;
    let reasonCode = null;

    if (bestDistance <= allowedRadius) {
      if (spoofSuspected) {
        finalStatus = 'flagged';
        reasonCode = 'LOCATION_SPOOF_SUSPECTED';
        responseMessage = "You're close enough, but your location signal was unstable. Your lecturer will review this.";
      } else {
        finalStatus = 'verified';
        responseMessage = "Verified via GPS.";
      }
    } else if (bestDistance > hardBlockRadius) {
      finalStatus = 'flagged';
      reasonCode = 'OUT_OF_BOUNDS';
      responseMessage = `You are ${Math.round(bestDistance)}m from the class anchor. You must be inside the lecture hall (allowed: ${allowedRadius}m).`;
    } else {
      finalStatus = 'flagged';
      reasonCode = 'OUT_OF_BOUNDS';
      responseMessage = `You are ${Math.round(bestDistance)}m from the class anchor (allowed: ${allowedRadius}m). Move closer and try again.`;
    }

    const deviceInfoPayload = JSON.stringify({
      telemetry: validPings,
      evaluatedDistance: Math.round(bestDistance),
      distanceMeters: Math.round(bestDistance),
      bestAccuracy,
      hardwareFingerprint,
      verificationMethod,
      spoofSuspected,
      isIOS,
    });

    // ─── UPSERT ATTENDANCE LOG ───
    const { error: upsertError } = await supabase
      .from('attendance_logs')
      .upsert({
        session_id: sessionId,
        matric_number: cleanMatric,
        status: finalStatus,
        device_info: deviceInfoPayload,
        device_hash: credentialId,
      }, { 
        onConflict: 'session_id,matric_number',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error("Upsert failed:", upsertError);
      return NextResponse.json({ status: 'failed', message: "Database error. Please try again." }, { status: 500 });
    }

    // ─── WRITE AUDIT LOG ───
    auditLogPayload.outcome = finalStatus;
    auditLogPayload.reason_code = reasonCode || auditLogPayload.reason_code;
    auditLogPayload.reason_detail = auditLogPayload.reason_detail || { distance: Math.round(bestDistance), accuracy: bestAccuracy };
    await supabase.from('checkin_attempts').insert(auditLogPayload);

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