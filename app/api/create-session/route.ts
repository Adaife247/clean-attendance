import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { verifyLecturer } from '@/utils/api-auth';
import { headers } from 'next/headers';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@campuscheck.com';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseIdToSave = body.courseId;
    const isRepStarting = body.startedBy === 'Class Rep';
    
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const lecturerIp = forwarded ? forwarded.split(',')[0].trim() : (headersList.get('x-real-ip') || 'unknown-ip');

    let authUserId = null;
    let finalStartedBy = 'lecturer';

    if (!courseIdToSave) {
      return NextResponse.json({ error: "Missing course ID." }, { status: 400 });
    }

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, course_code')
      .eq('id', courseIdToSave)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // CHECK FOR EXISTING ACTIVE SESSION
    const { data: existingSession } = await supabase
      .from('lecture_sessions')
      .select('session_id')
      .eq('course_id', course.id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingSession) {
      return NextResponse.json({ 
        sessionId: existingSession.session_id, 
        message: "Resumed existing active session" 
      });
    }

    if (isRepStarting) {
      const cleanRepMatric = String(body.repMatric || '').toUpperCase().trim();
      const { data: rep } = await supabase
        .from('course_reps')
        .select('id')
        .eq('course_id', course.id)
        .eq('matric_number', cleanRepMatric)
        .maybeSingle();

      if (!rep) return NextResponse.json({ error: 'Unauthorized: Not a valid Class Rep' }, { status: 403 });
      finalStartedBy = 'Class Rep';
    } else {
      const auth = await verifyLecturer(request);
      if (auth.error) return auth.error;
      authUserId = auth.user.id;

      const { data: ownedCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('id', course.id)
        .eq('lecturer_id', authUserId)
        .maybeSingle();

      if (!ownedCourse) return NextResponse.json({ error: 'Unauthorized for this course' }, { status: 403 });
    }

    const parsedDuration = parseInt(body.duration);
    const durationMinutes = Number.isFinite(parsedDuration) ? Math.min(Math.max(parsedDuration, 5), 120) : 60;
    const parsedWait = parseInt(body.checkinOpensAfter);
    const checkinOpensAfterMinutes = Number.isFinite(parsedWait) ? Math.min(Math.max(parsedWait, 0), 60) : 0;

    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    const { data, error } = await supabase
      .from('lecture_sessions')
      .insert([{
        course_id: course.id,
        course_code: course.course_code,
        anchor_latitude: body.latitude || body.lat,
        anchor_longitude: body.longitude || body.lng,
        anchor_ip: lecturerIp, 
        is_active: true,
        expires_at: expiresAt,
        checkin_opens_after_minutes: checkinOpensAfterMinutes,
        started_by: finalStartedBy
      }])
      .select('session_id')
      .single();

    if (error) {
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    try {
      const { data: enrollments } = await supabase.from('enrollments').select('matric_number').eq('course_id', course.id);
      if (enrollments && enrollments.length > 0) {
        const matrics = enrollments.map(e => e.matric_number);
        const { data: subscriptions } = await supabase.from('push_subscriptions').select('subscription').in('matric_number', matrics);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: `Class is Live: ${course.course_code}`,
            body: `The ${finalStartedBy} has started attendance. Tap to check in now!`,
            url: `/?sessionId=${data.session_id}`
          });

          const pushPromises = subscriptions.map(sub => 
            webpush.sendNotification(sub.subscription, payload).catch(() => {
              return supabase.from('push_subscriptions').delete().eq('subscription', sub.subscription);
            })
          );
          await Promise.all(pushPromises);
        }
      }
    } catch (pushError) {
      console.error("Push failed:", pushError);
    }

    return NextResponse.json({ sessionId: data.session_id, expiresAt });

  } catch {
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}