'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Megaphone, Send, Link as LinkIcon, Loader2, Clock } from 'lucide-react';

interface Course { id: string; course_code: string; }
interface LecturerProfile { full_name: string; }
interface BroadcastPost {
  id: string;
  title: string;
  content: string;
  course_code: string;
  created_at: string;
}

export default function BroadcastPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  
  const [feedTitle, setFeedTitle] = useState('');
  const [feedContent, setFeedContent] = useState('');
  const [feedCourseCode, setFeedCourseCode] = useState('');
  const [feedLink, setFeedLink] = useState('');
  const [feedExpiry, setFeedExpiry] = useState('');
  
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<BroadcastPost[]>([]);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profileData } = await supabase
      .from('lecturers')
      .select('full_name')
      .eq('id', session.user.id)
      .single();
    if (profileData) setProfile(profileData);

    const { data: courseData } = await supabase
      .from('courses')
      .select('id, course_code')
      .eq('lecturer_id', session.user.id)
      .order('created_at', { ascending: false });
    if (courseData) {
      setCourses(courseData);
      if (courseData.length > 0) setFeedCourseCode(courseData[0].course_code);
    }

    if (profileData) {
      const courseCodes = courseData?.map(c => c.course_code) || [];
      if (courseCodes.length > 0) {
        const { data: posts } = await supabase
          .from('campus_updates')
          .select('id, title, content, course_code, created_at')
          .in('course_code', courseCodes)
          .order('created_at', { ascending: false })
          .limit(5);
        if (posts) setHistory(posts);
      }
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    const id = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const handlePostFeed = async () => {
    if (!feedTitle.trim() || !feedContent.trim() || !feedCourseCode) {
      alert("Please fill all fields and select a course.");
      return;
    }
    setIsPosting(true);
    try {
      const response = await fetch('/api/post-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: feedTitle,
          content: feedContent,
          author: profile?.full_name || 'Lecturer',
          course_code: feedCourseCode,
          link_url: feedLink.trim() || null,
          expires_at: feedExpiry || null
        })
      });
      if (response.ok) {
        alert(`Announcement posted to ${feedCourseCode} students!`);
        setFeedTitle('');
        setFeedContent('');
        setFeedLink('');
        setFeedExpiry('');
        fetchData();
      } else {
        alert("Failed to post announcement.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setIsPosting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto font-sans space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-[#2563EB] p-6 text-white">
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><Megaphone size={24} /> Campus Broadcast</h1>
          <p className="text-blue-100 font-medium mt-1">Send announcements and updates to your students.</p>
        </div>
        
        <div className="p-6 md:p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Class</label>
            <select 
              value={feedCourseCode} 
              onChange={e => setFeedCourseCode(e.target.value)} 
              className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none font-bold text-gray-900 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all cursor-pointer"
            >
              <option value="">-- Select a Course --</option>
              {courses.map(c => <option key={c.id} value={c.course_code}>{c.course_code}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Announcement Title</label>
            <input 
              type="text" 
              value={feedTitle} 
              onChange={e => setFeedTitle(e.target.value)} 
              placeholder="e.g., Venue Change for Mid-Term Exam" 
              className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none font-bold text-gray-900 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Message</label>
            <textarea 
              value={feedContent} 
              onChange={e => setFeedContent(e.target.value)} 
              placeholder="Type your announcement here..." 
              rows={3} 
              className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none font-medium text-gray-900 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all resize-none" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Link (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><LinkIcon size={16} className="text-gray-400" /></div>
                <input 
                  type="url" 
                  value={feedLink} 
                  onChange={e => setFeedLink(e.target.value)} 
                  placeholder="https://..." 
                  className="w-full bg-gray-50 border border-gray-200 p-4 pl-12 rounded-xl outline-none font-medium text-gray-900 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expiry Date (Optional)</label>
              <input 
                type="datetime-local" 
                value={feedExpiry} 
                onChange={e => setFeedExpiry(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none font-medium text-gray-600 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
              />
            </div>
          </div>

          <button 
            onClick={handlePostFeed} 
            disabled={isPosting || !feedTitle.trim() || !feedContent.trim() || !feedCourseCode} 
            className="w-full bg-[#2563EB] text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex justify-center items-center gap-2 mt-4"
          >
            {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Publish Broadcast
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-6">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Clock size={18} /> Recent Broadcasts</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {history.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Megaphone size={36} className="text-[#2563EB]" />
              </div>
              <h3 className="font-extrabold text-gray-900 text-lg mb-1">No broadcasts yet</h3>
              <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto leading-relaxed">
                Your announcements to students will appear here after you publish your first one.
              </p>
            </div>
          ) : (
            history.map((post) => (
              <div key={post.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-extrabold text-gray-900">{post.title}</h4>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">{post.course_code}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 mb-2">{post.content}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Sent {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}