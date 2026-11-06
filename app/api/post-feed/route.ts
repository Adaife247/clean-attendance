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

    const { title, content, author, courseId, link_url, expires_at } = await request.json();

    if (!title || !content || !courseId) {
      return NextResponse.json({ error: 'Title, content, and courseId are required' }, { status: 400 });
    }

    const isGlobal = courseId === 'GLOBAL';
    let courseCode: string | null = null;

    if (!isGlobal) {
      const { data: course } = await supabase
        .from('courses')
        .select('id, course_code')
        .eq('id', courseId)
        .eq('lecturer_id', auth.user.id)
        .maybeSingle();

      if (!course) {
        return NextResponse.json({ error: 'Unauthorized for this course' }, { status: 403 });
      }
      courseCode = course.course_code;
    }

    // Insert the broadcast
    const { error } = await supabase.from('campus_updates').insert([{
      title,
      content,
      author: author || 'Lecturer',
      course_id: isGlobal ? null : courseId,
      course_code: isGlobal ? null : courseCode,
      link_url: link_url || null,
      expires_at: expires_at || null
    }]);

    if (error) throw error;

    // ─── SEND PUSH NOTIFICATIONS ───
    try {
      let targetMatrics: string[] = [];

      if (isGlobal) {
        // Send to EVERYONE who has a subscription
        const { data: allSubs } = await supabase.from('push_subscriptions').select('matric_number');
        targetMatrics = allSubs?.map(s => s.matric_number) || [];
      } else {
        // Send only to students enrolled in that course
        const { data: enrollments } = await supabase.from('enrollments').select('matric_number').eq('course_id', courseId);
        targetMatrics = enrollments?.map(e => e.matric_number) || [];
      }

      if (targetMatrics.length > 0) {
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .in('matric_number', targetMatrics);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: isGlobal ? `🌍 Campus Update` : `📢 ${courseCode} Announcement`,
            body: title,
            url: '/student-hub'
          });

          const pushPromises = subscriptions.map(sub =>
            webpush.sendNotification(sub.subscription, payload).catch(err => {
              if (err.statusCode === 410) {
                return supabase.from('push_subscriptions').delete().eq('subscription', sub.subscription);
              }
            })
          );
          await Promise.all(pushPromises);
        }
      }
    } catch (pushError) {
      console.error('Broadcast push failed:', pushError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to post update' }, { status: 500 });
  }
}