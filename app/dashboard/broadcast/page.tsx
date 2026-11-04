'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { Megaphone, Send, Link as LinkIcon, Loader2, Clock, PenTool } from 'lucide-react';
import { ToastContainer, useToast } from '@/components/Toast';

interface Course { id: string; course_code: string; }
interface LecturerProfile { full_name: string; }
interface BroadcastPost {
  id: string;
  title: string;
  content: string;
  course_code: string | null;
  author: string;
  created_at: string;
}

export default function BroadcastPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  
  const [feedTitle, setFeedTitle] = useState('');
  const [feedContent, setFeedContent] = useState('');
  const [feedCourseId, setFeedCourseId] = useState('');
  const [feedCourseCode, setFeedCourseCode] = useState('');
  const [feedAuthor, setFeedAuthor] = useState('');
  const [feedLink, setFeedLink] = useState('');
  const [feedExpiry, setFeedExpiry] = useState('');
  
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<BroadcastPost[]>([]);

  const { toasts, addToast, removeToast } = useToast();

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profileData } = await supabase
      .from('lecturers')
      .select('full_name')
      .eq('id', session.user.id)
      .single();
      
    if (profileData) {
      setProfile(profileData);
      setFeedAuthor(prev => prev || profileData.full_name);
    }

    const { data: courseData } = await supabase
      .from('courses')
      .select('id, course_code')
      .eq('lecturer_id', session.user.id)
      .order('created_at', { ascending: false });
      
    if (courseData && courseData.length > 0) {
      setCourses(courseData);
      setFeedCourseId(prev => prev || courseData[0].id);
      setFeedCourseCode(prev => prev || courseData[0].course_code);
    }

    if (profileData && courseData) {
      const courseIds = courseData.map(c => c.id);
      if (courseIds.length > 0) {
        const { data: posts } = await supabase
          .from('campus_updates')
          .select('id, title, content, course_code, author, created_at')
          .or(`course_id.in.(${courseIds.join(',')}),course_id.is.null`)
          .order('created_at', { ascending: false })
          .limit(5);
        if (posts) setHistory(posts);
      }
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  const handlePostFeed = async () => {
    if (!feedTitle.trim() || !feedContent.trim() || !feedCourseId) {
      addToast('Missing Fields', 'Please fill all fields and select an audience.', 'error');
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
          author: feedAuthor.trim() || profile?.full_name || 'Lecturer',
          courseId: feedCourseId,
          link_url: feedLink.trim() || null,
          expires_at: feedExpiry || null
        })
      });
      if (response.ok) {
        addToast('Success', `Announcement posted to ${feedCourseId === 'GLOBAL' ? 'All Students' : feedCourseCode} successfully!`, 'success');
        setFeedTitle('');
        setFeedContent('');
        setFeedLink('');
        setFeedExpiry('');
        fetchData();
      } else {
        addToast('Error', 'Failed to post announcement.', 'error');
      }
    } catch {
      addToast('Network Error', 'Check your connection and try again.', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto font-sans space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen transition-colors duration-300">
      
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 transition-colors">
        <div className="bg-[#2563EB] p-6 text-white">
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><Megaphone size={24} /> Campus Broadcast</h1>
          <p className="text-blue-100 font-medium mt-1">Send announcements to a specific class or the entire school.</p>
        </div>
        
        <div className="p-6 md:p-8 space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Target Audience</label>
            <select 
              value={feedCourseId} 
              onChange={e => {
                setFeedCourseId(e.target.value);
                setFeedCourseCode(courses.find(c => c.id === e.target.value)?.course_code || '');
              }} 
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl outline-none font-bold text-gray-900 dark:text-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all cursor-pointer"
            >
              <option value="GLOBAL">🌍 Global (All Students)</option>
              <option value="" disabled>--- Specific Courses ---</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
            </select>
          </div>

          <div>
            {/* FIXED: Removed 'block' and kept 'flex' */}
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <PenTool size={12} /> Signed By (Name & Title)
            </label>
            <input 
              type="text" 
              value={feedAuthor} 
              onChange={e => setFeedAuthor(e.target.value)} 
              placeholder="e.g., Dr. Adebayo, HOD of Computer Science" 
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl outline-none font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
            />
            <p className="text-[10px] text-gray-400 mt-1 ml-1">Students will see this on the announcement.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Announcement Title</label>
            <input 
              type="text" 
              value={feedTitle} 
              onChange={e => setFeedTitle(e.target.value)} 
              placeholder="e.g., Venue Change for Mid-Term Exam" 
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl outline-none font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Message</label>
            <textarea 
              value={feedContent} 
              onChange={e => setFeedContent(e.target.value)} 
              placeholder="Type your announcement here..." 
              rows={3} 
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl outline-none font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all resize-none" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Link (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><LinkIcon size={16} className="text-gray-400 dark:text-gray-500" /></div>
                <input 
                  type="url" 
                  value={feedLink} 
                  onChange={e => setFeedLink(e.target.value)} 
                  placeholder="https://..." 
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 pl-12 rounded-xl outline-none font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Expiry Date (Optional)</label>
              <input 
                type="datetime-local" 
                value={feedExpiry} 
                onChange={e => setFeedExpiry(e.target.value)} 
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl outline-none font-medium text-gray-600 dark:text-gray-300 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all" 
              />
            </div>
          </div>

          <button 
            onClick={handlePostFeed} 
            disabled={isPosting || !feedTitle.trim() || !feedContent.trim() || !feedCourseId} 
            className="w-full bg-[#2563EB] text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex justify-center items-center gap-2 mt-4"
          >
            {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Publish Broadcast
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-6 transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between transition-colors">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Clock size={18} /> Recent Broadcasts</h2>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {history.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                <Megaphone size={36} className="text-[#2563EB] dark:text-blue-400" />
              </div>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-lg mb-1">No broadcasts yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
                Your announcements to students will appear here after you publish your first one.
              </p>
            </div>
          ) : (
            history.map((post) => (
              <div key={post.id} className="p-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-extrabold text-gray-900 dark:text-white">{post.title}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    post.course_code 
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' 
                      : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800'
                  }`}>
                    {post.course_code || '🌍 Global'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-2">{post.content}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-3 border-t border-gray-100 dark:border-gray-800 pt-2">
                  <PenTool size={10} /> Signed by: {post.author} • {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}