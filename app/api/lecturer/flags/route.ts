import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';

interface CheckinFlag {
  id: string;
  session_id: string;
  matric_number: string;
  outcome: string;
  reason_code: string | null;
  reason_detail: Record<string, unknown> | null;
  ip_address: string;
  created_at: string;
}

interface RegistrationFlag {
  id: string;
  matric_number: string;
  hardware_fingerprint: string;
  reason_code: string;
  reason_detail: Record<string, unknown> | null;
  ip_address: string;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    // 1. Get lecturer's courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id, course_code')
      .eq('lecturer_id', auth.user.id);

    if (!courses || courses.length === 0) {
      return NextResponse.json({ checkinFlags: [], regFlags: [] });
    }

    const courseIds = courses.map(c => c.id);

    // 2. Get sessions for these courses using course_id
    const { data: sessions } = await supabase
      .from('lecture_sessions')
      .select('session_id')
      .in('course_id', courseIds);

    const sessionIds = sessions?.map(s => s.session_id) || [];

    // 3. Get checkin_attempts (Audit Log)
    let checkinFlags: CheckinFlag[] = [];
    if (sessionIds.length > 0) {
      const { data: attempts } = await supabase
        .from('checkin_attempts')
        .select('*')
        .in('session_id', sessionIds)
        .in('outcome', ['flagged', 'blocked'])
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (attempts) checkinFlags = attempts as CheckinFlag[];
    }

    // 4. Get registration_flags for students enrolled in these courses
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('matric_number')
      .in('course_id', courseIds);
    
    const matrics = [...new Set(enrollments?.map(e => e.matric_number) || [])];
    let regFlags: RegistrationFlag[] = [];
    
    if (matrics.length > 0) {
      const { data: rFlags } = await supabase
        .from('registration_flags')
        .select('*')
        .in('matric_number', matrics)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (rFlags) regFlags = rFlags as RegistrationFlag[];
    }

    return NextResponse.json({ checkinFlags, regFlags });
  } catch (error) {
    console.error("Flags API Error:", error);
    return NextResponse.json({ error: 'Failed to load flags' }, { status: 500 });
  }
}