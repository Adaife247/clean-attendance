import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Haversine formula to calculate distance in meters
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
    const body = await request.json();
    const { sessionId, matricNumber, telemetry } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!sessionId || !cleanMatric || !telemetry || telemetry.length === 0) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    // 1. GET THE LECTURER'S SESSION DATA
    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) return NextResponse.json({ message: "Invalid or expired session link." }, { status: 404 });
    if (session.is_active !== true) return NextResponse.json({ message: "Attendance window has closed." }, { status: 403 });

    // 2. SMART ROSTER ENFORCEMENT
    let roster: string[] = [];
    if (session.course_code) {
      const { data: courseData } = await supabase.from('courses').select('roster').eq('course_code', session.course_code).single();
      if (courseData && courseData.roster) roster = courseData.roster;
    }
    
    if (roster.length > 0 && !roster.includes(cleanMatric)) {
      return NextResponse.json({ message: 'Unregistered: Your matric number is not on the official class list.' }, { status: 403 });
    }

    // 3. PREVENT DUPLICATES
    const { data: existingLog } = await supabase.from('attendance_logs').select('id').eq('session_id', sessionId).eq('matric_number', cleanMatric).single();
    if (existingLog) return NextResponse.json({ message: "You have already checked in to this session." }, { status: 409 });

    // 4. ZERO-TRUST: 48-HOUR HARDWARE COOLDOWN ENFORCEMENT
    const { data: device, error: deviceError } = await supabase
      .from('user_devices')
      .select('created_at')
      .eq('matric_number', cleanMatric)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ message: "Security Block: No biometric device registered to this matric number." }, { status: 403 });
    }

    const deviceRegistrationTime = new Date(device.created_at).getTime();
    const currentTime = new Date().getTime();
    const hoursSinceRegistration = (currentTime - deviceRegistrationTime) / (1000 * 60 * 60);

    if (hoursSinceRegistration < 48) {
      const hoursLeft = Math.ceil(48 - hoursSinceRegistration);
      return NextResponse.json({ 
        message: `Cooldown Active: Your device was recently reset. It will be locked for ${hoursLeft} more hours to prevent hardware sharing. Please use the Digital Hand Raise.` 
      }, { status: 403 });
    }

    // 5. THE SPOOF CATCHER MATH
    let isSpoofed = false;
    let totalDrift = 0;
    const initialLat = telemetry[0].lat;
    const initialLng = telemetry[0].lng;

    for (let i = 0; i < telemetry.length; i++) {
      const ping = telemetry[i];
      if (ping.acc === 1 || ping.acc === 5) isSpoofed = true;
      if (ping.alt === 0) isSpoofed = true;
      if (i > 0) {
        const drift = getDistanceInMeters(telemetry[i-1].lat, telemetry[i-1].lng, ping.lat, ping.lng);
        totalDrift += drift;
      }
    }

    if (telemetry.length >= 3 && totalDrift === 0) isSpoofed = true;

    // 6. THE GEOFENCE
    const distanceToLecturer = getDistanceInMeters(session.anchor_latitude, session.anchor_longitude, initialLat, initialLng);
    let finalStatus = 'absent';
    let responseMessage = `Distance Failed: You are ${Math.round(distanceToLecturer)} meters away.`;

    if (distanceToLecturer <= 50) {
      if (isSpoofed) {
        finalStatus = 'flagged'; 
        responseMessage = "Location anomaly detected. Please see lecturer.";
      } else {
        finalStatus = 'verified'; 
        responseMessage = "Verified";
      }
    }

    // 7. WRITE TO THE LEDGER (WebAuthn replaces device hash)
    await supabase.from('attendance_logs').insert([{
      session_id: sessionId,
      matric_number: cleanMatric,
      status: finalStatus,
      device_info: JSON.stringify({ telemetry }),
      device_hash: 'webauthn-secured' 
    }]);

    return NextResponse.json({ status: finalStatus, distance: Math.round(distanceToLecturer), message: responseMessage }, { status: 200 });

  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}