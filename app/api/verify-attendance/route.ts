import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
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
    const { sessionId, matricNumber, telemetry, deviceHash } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!sessionId || !cleanMatric || !telemetry || telemetry.length === 0) {
      return NextResponse.json({ message: "Invalid system payload structural layout" }, { status: 400 });
    }

    // 1. EVALUATE THE ENFORCED LECTURE SESSION WINDOW
    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ message: "The verification window for this token layout has expired or does not exist." }, { status: 404 });
    }
    
    if (session.is_active !== true) {
      return NextResponse.json({ message: "Operational registration limits closed for this block window." }, { status: 403 });
    }

  // 2. COURSE ROSTER SUB-QUERY ENFORCEMENT
    let roster: string[] = [];
    if (session.course_code) {
      const { data: courseData } = await supabase
        .from('courses')
        .select('roster')
        .eq('course_code', session.course_code)
        .single();
      
      if (courseData && courseData.roster) {
        roster = courseData.roster || [];
      }
    }
    
    const isRosterEnforced = roster.length > 0;
    if (isRosterEnforced && !roster.includes(cleanMatric)) {
      return NextResponse.json({ 
        message: 'Identity Validation Failed: Your matric identifier is not included in the verified roster block.' 
      }, { status: 403 });
    }

    // 3. RETRIEVE RECORD ENTRIES FOR DUPLICATE MATRIC ID CHECKS
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('matric_number', cleanMatric)
      .single();

    if (existingLog) {
      return NextResponse.json({ message: "This structural identification profile has already been logged into the current window." }, { status: 409 });
    }

    // 4. THE ZERO-TRUST HARDWARE INTEGRITY ANALYSIS (Blocks Incognito Proxies)
    if (deviceHash) {
      const { data: sharedDevice } = await supabase
        .from('attendance_logs')
        .select('matric_number')
        .eq('session_id', sessionId)
        .ilike('device_info', `%${deviceHash}%`) 
        .limit(1)
        .maybeSingle();

      if (sharedDevice && sharedDevice.matric_number !== cleanMatric) {
        return NextResponse.json({ 
          message: `Device configuration sharing restriction encountered. This physical smartphone hardware profile was already bound to an active identity ledger entry (${sharedDevice.matric_number}) during this lecture block.` 
        }, { status: 403 });
      }
    }

    // 5. GEO-SPOOF FRAUD FILTER ANALYSIS
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

    if (telemetry.length >= 3 && totalDrift === 0) {
      isSpoofed = true;
    }

    // 6. GEOFENCE RADIAL CALCULATIONS
    const distanceToLecturer = getDistanceInMeters(
      session.anchor_latitude, session.anchor_longitude, 
      initialLat, initialLng
    );

    let finalStatus = 'absent';
    let responseMessage = `Geofence validation failed. Computed radial offset indicates you are ${Math.round(distanceToLecturer)} meters outside operational bounds.`;

    if (distanceToLecturer <= 50) {
      if (isSpoofed) {
        finalStatus = 'flagged'; 
        responseMessage = "Telemetry modification markers present. Hardware configuration logged for auditing.";
      } else {
        finalStatus = 'verified'; 
        responseMessage = "Verified";
      }
    }

    // 7. WRITE THE COMPREHENSIVE STRUCTURAL LOG INTO THE ATTENDANCE STORAGE
    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([{
        session_id: sessionId,
        matric_number: cleanMatric,
        status: finalStatus,
        device_info: JSON.stringify({ telemetry, deviceHash }) 
      }]);

    if (logError) {
      console.error("Database Core Operational Failure:", logError);
      throw logError;
    }

    return NextResponse.json({ 
      status: finalStatus, 
      distance: Math.round(distanceToLecturer),
      message: responseMessage 
    }, { status: 200 });

  } catch (error) {
    console.error("Core System Execution Interruption:", error);
    return NextResponse.json({ message: "An unhandled exception broke execution processing workflows." }, { status: 500 });
  }
}