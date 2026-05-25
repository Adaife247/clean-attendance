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
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, matricNumber, telemetry, hardwareFingerprint } = body;
    const cleanMatric = matricNumber.toUpperCase().trim();

    if (!sessionId || !cleanMatric || !telemetry || telemetry.length === 0) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('anchor_latitude, anchor_longitude, is_active, course_code')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) return NextResponse.json({ message: "Invalid or expired session link." }, { status: 404 });
    if (session.is_active !== true) return NextResponse.json({ message: "Attendance window has closed." }, { status: 403 });

    let roster: string[] = [];
    if (session.course_code) {
      const { data: courseData } = await supabase.from('courses').select('roster').eq('course_code', session.course_code).single();
      if (courseData && courseData.roster) roster = courseData.roster;
    }
    
    const { data: existingLog } = await supabase.from('attendance_logs').select('id').eq('session_id', sessionId).eq('matric_number', cleanMatric).single();
    if (existingLog) return NextResponse.json({ message: "You have already checked in to this session." }, { status: 409 });

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
        return NextResponse.json({ status: 'flagged', distance: 0, message: "Security Block: Multiple check-ins detected from identical hardware specs." }, { status: 200 });
      }
    }

    let isSpoofed = false;
    let totalDrift = 0;
    let bestPing = telemetry[0]; 

    for (let i = 0; i < telemetry.length; i++) {
      const ping = telemetry[i];
      if (ping.acc === 1 || ping.acc === 5) isSpoofed = true;
      if (ping.alt === 0) isSpoofed = true;
      
      if (i > 0) {
        const drift = getDistanceInMeters(telemetry[i-1].lat, telemetry[i-1].lng, ping.lat, ping.lng);
        totalDrift += drift;
      }
      if (ping.acc < bestPing.acc) {
        bestPing = ping;
      }
    }

    if (telemetry.length >= 3 && totalDrift === 0) isSpoofed = true;

    const distanceToLecturer = getDistanceInMeters(session.anchor_latitude, session.anchor_longitude, bestPing.lat, bestPing.lng);
    
    // --- THE STRICT DISTANCE FIREWALL ---
    // Anyone further than 500 meters gets blocked entirely. No database entry, no dashboard flag.
    if (distanceToLecturer > 500) {
      return NextResponse.json({ 
        status: 'rejected', 
        distance: Math.round(distanceToLecturer), 
        message: "out of bounds" // Simple flag for the frontend to read
      }, { status: 403 });
    }

    let finalStatus = 'absent';
    let responseMessage = `Distance Failed: You are ${Math.round(distanceToLecturer)} meters away (Max: 150m).`;

    if (distanceToLecturer <= 150) {
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
      device_info: JSON.stringify({ telemetry, evaluatedAccuracy: bestPing.acc }),
      device_hash: hardwareFingerprint || 'unknown-hardware'
    }]);

    return NextResponse.json({ status: finalStatus, distance: Math.round(distanceToLecturer), message: responseMessage }, { status: 200 });

  } catch (error) {
    console.error("Verification API Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}