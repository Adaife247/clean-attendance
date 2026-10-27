export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

interface AttendanceLogRow {
  id: string;
  matric_number: string;
  status: string;
  check_in_time: string;
  device_info: string | null;
}

export async function GET(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    // NEW: Get the timezone from the client (fallback to West Africa Time if missing)
    const clientTimeZone = searchParams.get('timeZone') || 'Africa/Lagos';

    if (!sessionId) return NextResponse.json({ error: 'No sessionId' }, { status: 400 });

    const { data: session } = await supabase
      .from('lecture_sessions')
      .select('is_active, course_code, created_at')
      .eq('session_id', sessionId)
      .single();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const { data: course } = await supabase.from('courses').select('id').eq('course_code', session.course_code).eq('lecturer_id', auth.user.id).single();
    if (!course) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const courseName = session?.course_code || "Unknown Course";

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('check_in_time', { ascending: false });

    const visibleLogs = (logs as AttendanceLogRow[] | null || []).filter(l => l.status !== 'disqualified');
    const disqualifiedCount = (logs as AttendanceLogRow[] | null || []).filter(l => l.status === 'disqualified').length;

    const matrics = visibleLogs.map(l => l.matric_number);
    const { data: profiles } = await supabase
      .from('student_profiles')
      .select('matric_number, nickname')
      .in('matric_number', matrics);

    const nicknameMap = new Map();
    (profiles || []).forEach(p => nicknameMap.set(p.matric_number, p.nickname));

    return NextResponse.json({
      course: courseName,
      isActive: session?.is_active === true,
      createdAt: session?.created_at || null,
      hiddenDisqualifiedCount: disqualifiedCount,
      logs: visibleLogs.map((l) => {
        let reason = null;
        let isBiometric = false;
        
        if (l.device_info) {
          try {
            const info = JSON.parse(l.device_info);
            if (info.method === "Digital Hand Raise") reason = "Raised hand (GPS blocked)";
            else if (info.verificationMethod === 'skipped') {
              reason = "Biometric skipped (No hardware lock)";
              isBiometric = false;
            } else if (info.verificationMethod === 'biometric') {
              isBiometric = true;
            } else if (info.reason) {
              reason = info.reason;
            }
          } catch {}
        }
        
        // Use the dynamic client timezone
        const localTimeString = new Date(l.check_in_time).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: clientTimeZone
        });

        return {
          id: l.id,
          matricNumber: l.matric_number,
          nickname: nicknameMap.get(l.matric_number) || null,
          status: l.status,
          time: localTimeString,
          reason,
          isBiometric
        };
      })
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}