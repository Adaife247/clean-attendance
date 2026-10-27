import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import webpush from 'web-push';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@campuscheck.com';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
}

export async function POST(request: Request) {
  try {
    const { title, content, author, course_code, link_url, expires_at } = await request.json();
    
    if (!title || !content || !course_code) {
      return NextResponse.json({ error: 'Title, content, and course_code are required' }, { status: 400 });
    }

    const { error } = await supabase.from('campus_updates').insert([{
      title, 
      content, 
      author: author || 'Lecturer',
      course_code,
      link_url: link_url || null,
      expires_at: expires_at || null
    }]);

    if (error) throw error;

    // ─── NEW: SEND PUSH NOTIFICATIONS FOR BROADCAST ───
    try {
      // 1. Get all students enrolled in this course
      const { data: course } = await supabase.from('courses').select('id').eq('course_code', course_code).single();
      
      if (course) {
        const { data: enrollments } = await supabase.from('enrollments').select('matric_number').eq('course_id', course.id);
        
        if (enrollments && enrollments.length > 0) {
          const matrics = enrollments.map(e => e.matric_number);
          
          // 2. Find push subscriptions for these students
          const { data: subscriptions } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .in('matric_number', matrics);

          // 3. Send the notification
          if (subscriptions && subscriptions.length > 0) {
            const payload = JSON.stringify({
              title: `📢 ${course_code} Announcement`,
              body: title,
              url: `/portal` 
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
      }
    } catch (pushError) {
      console.error("Broadcast push failed:", pushError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to post update' }, { status: 500 });
  }
}