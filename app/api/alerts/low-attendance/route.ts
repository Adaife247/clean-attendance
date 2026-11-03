import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';
import webpush from 'web-push';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@campuscheck.com';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
}

export async function POST(request: Request) {
  try {
    const auth = await verifyLecturer(request);
    if (auth.error) return auth.error;

    const { courseCode } = await request.json();
    if (!courseCode) return NextResponse.json({ error: "Missing course code" }, { status: 400 });

    // 1. Verify the lecturer owns this course
    const { data: course } = await supabase
      .from('courses')
      .select('id, course_code, total_planned_classes')
      .eq('course_code', courseCode)
      .eq('lecturer_id', auth.user.id)
      .single();

    if (!course) return NextResponse.json({ error: "Course not found or unauthorized" }, { status: 403 });

    // 2. Get all sessions for this course
    const { data: sessions } = await supabase
      .from('lecture_sessions')
      .select('session_id')
      .eq('course_code', courseCode);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: "No sessions held yet." }, { status: 200 });
    }

    const sessionIds = sessions.map(s => s.session_id);
    const totalHeld = sessionIds.length;

    // 3. Get all enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('matric_number')
      .eq('course_id', course.id);

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ message: "No students enrolled." }, { status: 200 });
    }

    const allMatrics = enrollments.map(e => e.matric_number);

    // 4. Get all verified attendance logs
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('matric_number')
      .in('session_id', sessionIds)
      .eq('status', 'verified');

    // 5. Calculate attendance per student
    const attendanceCounts: Record<string, number> = {};
    logs?.forEach(log => {
      attendanceCounts[log.matric_number] = (attendanceCounts[log.matric_number] || 0) + 1;
    });

    const atRiskMatrics: string[] = [];
    allMatrics.forEach(matric => {
      const attended = attendanceCounts[matric] || 0;
      const percentage = (attended / totalHeld) * 100;
      if (percentage < 70) {
        atRiskMatrics.push(matric);
      }
    });

    if (atRiskMatrics.length === 0) {
      return NextResponse.json({ message: "No students are at risk. No alerts sent." }, { status: 200 });
    }

    // 6. Fetch push subscriptions for these at-risk students
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription, matric_number')
      .in('matric_number', atRiskMatrics);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: "At-risk students found, but none have push notifications enabled." }, { status: 200 });
    }

    // 7. Send notifications
    let successCount = 0;
    const payload = JSON.stringify({
      title: `⚠️ Attendance Warning: ${courseCode}`,
      body: `Your attendance is currently below 70%. You need to attend the upcoming classes to avoid disqualification from exams.`,
      url: `/student-hub`
    });

    const pushPromises = subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription, payload).then(() => {
        successCount++;
      }).catch(err => {
        if (err.statusCode === 410) {
          // Subscription expired, delete it
          return supabase.from('push_subscriptions').delete().eq('matric_number', sub.matric_number);
        }
      })
    );

    await Promise.all(pushPromises);

    return NextResponse.json({ 
      success: true, 
      atRiskCount: atRiskMatrics.length,
      alertsSent: successCount 
    });

  } catch (error) {
    console.error("Low Attendance Alert Error:", error);
    return NextResponse.json({ error: 'Failed to send alerts' }, { status: 500 });
  }
}