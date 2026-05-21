import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// The Haversine Formula: Calculates true distance between two GPS points in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, matricNumber, telemetry } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!sessionId || !cleanMatric || !telemetry || telemetry.length === 0) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    // 1. GET THE LECTURER'S SESSION DATA & COURSE ROSTER
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        lat, 
        lng, 
        status,
        courses ( roster )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ message: "Invalid or expired session link." }, { status: 404 });
    }
    if (session.status !== 'active') {
      return NextResponse.json({ message: "Attendance window has closed." }, { status: 403 });
    }

    // 2. SMART ROSTER ENFORCEMENT
    // Check if the student is on the roster (if roster exists)
    const roster = (session as any).courses?.roster || [];
    const isRosterEnforced = roster.length > 0;
    
    if (isRosterEnforced && !roster.includes(cleanMatric)) {
      return NextResponse.json({ 
        message: 'Unregistered: Your matric number is not on the official class list.' 
      }, { status: 403 });
    }

    // 3. PREVENT DUPLICATES
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog) {
      return NextResponse.json({ message: "You have already checked in to this session." }, { status: 409 });
    }

    // 4. THE SPOOF CATCHER MATH
    let isSpoofed = false;
    let totalDrift = 0;
    const initialLat = telemetry[0].lat;
    const initialLng = telemetry[0].lng;

    for (let i = 0; i < telemetry.length; i++) {
      const ping = telemetry[i];
      
      // Trap A: Fake GPS apps often lock accuracy at exactly 1.0 or 5.0 meters
      if (ping.acc === 1 || ping.acc === 5) isSpoofed = true;
      
      // Trap B: Fake GPS apps sometimes output exactly 0 altitude
      if (ping.alt === 0) isSpoofed = true;

      // Trap C: Check for zero drift. Real GPS jitters slightly every second.
      if (i > 0) {
        const drift = getDistanceInMeters(telemetry[i-1].lat, telemetry[i-1].lng, ping.lat, ping.lng);
        totalDrift += drift;
      }
    }

    // If there are 3 pings and ZERO physical drift between them, it's a frozen fake location
    if (telemetry.length >= 3 && totalDrift === 0) {
      isSpoofed = true;
    }

    // 5. THE GEOFENCE (Distance Check)
    const distanceToLecturer = getDistanceInMeters(
      session.lat, session.lng, 
      initialLat, initialLng
    );

    let finalStatus = 'absent';
    let responseMessage = `Distance Failed: You are ${Math.round(distanceToLecturer)} meters away.`;

    // 50-meter Geofence logic
    if (distanceToLecturer <= 50) {
      if (isSpoofed) {
        finalStatus = 'flagged'; // Inside radius, but using Fake GPS
        responseMessage = "Location anomaly detected. Please see lecturer.";
      } else {
        finalStatus = 'verified'; // Inside radius and passed physics check
        responseMessage = "Verified";
      }
    }

    // 6. WRITE TO THE LEDGER
    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: finalStatus,
        device_info: JSON.stringify(telemetry)
      }]);

    if (logError) throw logError;

    // 7. RETURN VERDICT TO THE UI
    return NextResponse.json({ 
      status: finalStatus, 
      distance: Math.round(distanceToLecturer),
      message: responseMessage 
    }, { status: 200 });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}