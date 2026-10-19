'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ShieldCheck, User, Clock, ArrowLeft, Lock,
  Megaphone, Calendar, Edit3, Save, FileText, Plus
} from 'lucide-react';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';

interface CourseRecord {
  course_code: string;
  total_classes: number;
  attended_classes: number;
  percentage: number;
  skips_left: number;
  streak: number;
  streak_tier: 'JJC' | 'Consistent' | 'Odogwu' | 'None';
}

interface LogRow { session_id: string; status: string; }
interface SessionRow { session_id: string; course_code: string; created_at: string; is_active: boolean; expires_at: string | null; }
interface HistoryRow extends SessionRow { status: string; }
interface CampusUpdate { id: string; title: string; content: string; author: string; course_code: string | null; created_at: string; }
interface AvailableCourse { id: string; course_code: string; department: string; level: string; }

export default function StudentPortal() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'feed' | 'register'>('dashboard');
  
  const [matricNumber, setMatricNumber] = useState('');
  const [studentDept, setStudentDept] = useState('');
  const [studentLevel, setStudentLevel] = useState('');
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [records, setRecords] = useState<CourseRecord[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState('');
  const [activeLiveClass, setActiveLiveClass] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [savedNickname, setSavedNickname] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [feed, setFeed] = useState<CampusUpdate[]>([]);
  
  // Self-registration State
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [isEnrolling, setIsEnrolling] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('campuscheck_student_matric');
    if (saved) {
      const id = setTimeout(() => { setMatricNumber(saved); }, 0);
      return () => clearTimeout(id);
    }
  }, []);

  const handleVerifyAndFetch = async () => {
    if (matricNumber.length < 5) return;
    setIsVerifying(true);
    setError('');
    setRecords(null);
    setHistory(null);
    setActiveLiveClass(null);

    const cleanMatric = matricNumber.toUpperCase().trim();
    localStorage.setItem('campuscheck_student_matric', cleanMatric);

    try {
      // 1. WebAuthn
      const genRes = await fetch('/api/webauthn/auth/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric })
      });

      if (genRes.status === 404) {
        throw new Error("You haven't linked your biometrics yet. You must check into a lecture first.");
      }

      const options = await genRes.json();
      if (options.error) throw new Error(options.error);

      const asseResp = await startAuthentication(options);

      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric, authResponse: asseResp })
      });

      const verifyResult = await verifyRes.json();
      if (!verifyResult.verified) throw new Error("Biometric verification failed. Access denied.");

      // 2. Fetch Profile
      const { data: profile } = await supabase
        .from('student_profiles')
        .select('nickname, department, level')
        .eq('matric_number', cleanMatric)
        .maybeSingle();

      if (profile?.nickname) {
        setNickname(profile.nickname);
        setSavedNickname(profile.nickname);
      }
      if (profile?.department) setStudentDept(profile.department);
      if (profile?.level) setStudentLevel(profile.level);

      // 3. Fetch Feed
      const { data: feedData } = await supabase
        .from('campus_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (feedData) setFeed(feedData);

      // 4. Fetch Records (Only enrolled)
      const { data: enrollmentRows, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('matric_number', cleanMatric);

      if (enrollError) throw enrollError;

      if (!enrollmentRows || enrollmentRows.length === 0) {
        setRecords([]);
        return;
      }

      const courseIds = enrollmentRows.map(e => e.course_id);
      const { data: courseRows, error: courseError } = await supabase
        .from('courses')
        .select('id, course_code')
        .in('id', courseIds);

      if (courseError) throw courseError;
      const courseCodes = courseRows?.map(c => c.course_code) || [];

      const { data: sessionRows, error: sessionError } = await supabase
        .from('lecture_sessions')
        .select('session_id, course_code, created_at, is_active, expires_at')
        .in('course_code', courseCodes)
        .order('created_at', { ascending: false });

      if (sessionError) throw sessionError;

      const now = new Date().getTime();
      const liveSession = sessionRows?.find(s => {
        if (!s.is_active) return false;
        const isExpired = s.expires_at && new Date(s.expires_at).getTime() < now;
        return !isExpired;
      });
      if (liveSession) setActiveLiveClass(liveSession.course_code);

      const sessionIds = (sessionRows || []).map(s => s.session_id);
      let studentLogs: LogRow[] = [];

      if (sessionIds.length > 0) {
        const { data: logRows, error: logError } = await supabase
          .from('attendance_logs')
          .select('session_id, status')
          .eq('matric_number', cleanMatric)
          .in('session_id', sessionIds);

        if (logError) throw logError;
        studentLogs = logRows || [];
      }

      const logStatusMap = new Map<string, string>();
      studentLogs.forEach(l => logStatusMap.set(l.session_id, l.status));

      const historyData: HistoryRow[] = (sessionRows || []).map(session => {
        const status = logStatusMap.get(session.session_id) || 'absent';
        return { ...session, status };
      });
      setHistory(historyData);

      const courseStats = new Map<string, { total: number; attended: number; sessions: SessionRow[] }>();
      (sessionRows as SessionRow[] || []).forEach(session => {
        const course = session.course_code;
        const stats = courseStats.get(course) || { total: 0, attended: 0, sessions: [] };
        stats.total += 1;
        stats.sessions.push(session);
        if (logStatusMap.get(session.session_id) === 'verified') stats.attended += 1;
        courseStats.set(course, stats);
      });

      const finalRecords: CourseRecord[] = [];
      courseStats.forEach((stats, course) => {
        const total = stats.total;
        const attended = stats.attended;
        const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
        const maxAbsences = Math.floor(total * 0.30);
        const currentAbsences = total - attended;
        const skipsLeft = Math.max(0, maxAbsences - currentAbsences);

        let streak = 0;
        for (const session of stats.sessions) {
          if (logStatusMap.get(session.session_id) === 'verified') streak += 1;
          else break;
        }

        let tier: CourseRecord['streak_tier'] = 'None';
        if (streak >= 10) tier = 'Odogwu';
        else if (streak >= 5) tier = 'Consistent';
        else if (streak >= 1) tier = 'JJC';

        finalRecords.push({
          course_code: course, total_classes: total, attended_classes: attended,
          percentage, skips_left: skipsLeft, streak, streak_tier: tier,
        });
      });

      finalRecords.sort((a, b) => a.course_code.localeCompare(b.course_code));
      setRecords(finalRecords);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed.";
      setRecords(null);
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const saveProfile = async () => {
    if (!matricNumber) return;
    await supabase.from('student_profiles').upsert({
      matric_number: matricNumber.toUpperCase().trim(),
      nickname: nickname.trim(),
      department: studentDept.toUpperCase().trim(),
      level: studentLevel.trim()
    });
    setSavedNickname(nickname.trim());
    setIsEditingNickname(false);
    fetchAvailableCourses();
  };

  const fetchAvailableCourses = useCallback(async () => {
    if (!studentDept || !studentLevel) return;
    
    const { data: allCourses } = await supabase
      .from('courses')
      .select('id, course_code, department, level')
      .eq('department', studentDept.toUpperCase())
      .eq('level', studentLevel);

    if (allCourses) {
      const { data: enrolled } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('matric_number', matricNumber.toUpperCase().trim());
      
      const enrolledIds = new Set(enrolled?.map(e => e.course_id) || []);
      const available = allCourses.filter(c => !enrolledIds.has(c.id));
      
      setAvailableCourses(available);
    }
  }, [studentDept, studentLevel, matricNumber]);

  useEffect(() => {
    if (activeTab === 'register') fetchAvailableCourses();
  }, [activeTab, fetchAvailableCourses]);

  const handleEnroll = async (courseId: string, courseCode: string) => {
    setIsEnrolling(courseId);
    try {
      const { error } = await supabase.from('enrollments').insert([{
        course_id: courseId,
        matric_number: matricNumber.toUpperCase().trim()
      }]);
      if (error) throw error;
      alert(`Successfully enrolled in ${courseCode}!`);
      handleVerifyAndFetch();
      setActiveTab('dashboard');
    } catch {
      alert("Failed to enroll. Please try again.");
    } finally {
      setIsEnrolling(null);
    }
  };

  const getShieldColor = (pct: number) => {
    if (pct >= 70) return { bar: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' };
    if (pct >= 50) return { bar: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]', text: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-200' };
    return { bar: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-red-700', bg: 'bg-red-50/50', border: 'border-red-200' };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 pt-4">
        
        <div className="text-center mb-6 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4">
          <div className="bg-[#2563EB] w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 relative overflow-hidden">
            <ShieldCheck className="w-7 h-7 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {savedNickname ? `Hey, ${savedNickname}!` : 'Survival Companion'}
          </h1>
          <p className="text-gray-500 mt-1 font-medium text-sm">Track your NUC clearance status</p>
        </div>

        {activeLiveClass && (
          <div className="mb-6 bg-green-500 text-white p-4 rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-between animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full animate-pulse"><Clock size={20} /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-green-100">Live Now</p>
                <p className="font-extrabold text-lg">{activeLiveClass}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-white/80 text-right leading-tight max-w-20">Check WhatsApp</span>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-4xl shadow-xl shadow-gray-200/50 border border-white p-6 animate-in fade-in slide-in-from-bottom-6">
          
          {!records && (
            <>
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
                <input type="text" placeholder="Matric Number (e.g. CSC/2021/001)" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && handleVerifyAndFetch()} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium" />
              </div>
              <button onClick={handleVerifyAndFetch} disabled={matricNumber.length < 5 || isVerifying} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-gray-900/20 hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70">
                {isVerifying ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
                {isVerifying ? "Verifying..." : "Unlock Portal"}
              </button>
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100 text-center animate-in fade-in">
                  <p className="text-red-700 font-bold text-sm">{error}</p>
                </div>
              )}
            </>
          )}

          {records && (
            <>
              <div className="flex bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
                <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Shield</button>
                <button onClick={() => setActiveTab('records')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'records' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Records</button>
                <button onClick={() => setActiveTab('register')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'register' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Register</button>
                <button onClick={() => setActiveTab('feed')} className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'feed' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Feed</button>
              </div>

              {activeTab === 'dashboard' && (
                <div className="space-y-5 animate-in fade-in">
                  
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Profile:</span>
                        {isEditingNickname ? (
                          <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="bg-white border border-blue-200 rounded px-2 py-1 text-sm font-bold text-gray-900 outline-none w-24" placeholder="Nickname" maxLength={15} />
                        ) : (
                          <span className="text-sm font-black text-blue-900">{savedNickname || 'Not set'}</span>
                        )}
                      </div>
                      {isEditingNickname ? (
                        <button onClick={saveProfile} className="text-blue-600 hover:text-blue-800"><Save size={16} /></button>
                      ) : (
                        <button onClick={() => setIsEditingNickname(true)} className="text-blue-500 hover:text-blue-700"><Edit3 size={16} /></button>
                      )}
                    </div>
                    
                    {isEditingNickname && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-200">
                        <input type="text" value={studentDept} onChange={e => setStudentDept(e.target.value)} placeholder="Dept (e.g., CSC)" className="bg-white border border-blue-200 rounded px-2 py-1 text-xs font-bold text-gray-900 outline-none w-full uppercase" />
                        <input type="text" value={studentLevel} onChange={e => setStudentLevel(e.target.value)} placeholder="Level (e.g., 200)" className="bg-white border border-blue-200 rounded px-2 py-1 text-xs font-bold text-gray-900 outline-none w-full" />
                      </div>
                    )}
                  </div>

                  {records.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-2xl border border-gray-200">
                      <p className="text-sm font-bold text-gray-500">You have no courses yet.</p>
                      <button onClick={() => setActiveTab('register')} className="mt-3 text-[#2563EB] font-bold text-sm hover:underline">Go to Course Registration</button>
                    </div>
                  ) : (
                    records.map((record) => {
                      const colors = getShieldColor(record.percentage);
                      return (
                        <div key={record.course_code} className={`relative overflow-hidden ${colors.bg} p-4 rounded-2xl border ${colors.border}`}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-black text-gray-900 text-lg">{record.course_code}</p>
                              <p className="text-[11px] text-gray-600 font-semibold mt-0.5">{record.attended_classes} / {record.total_classes} Classes</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-black text-2xl ${colors.text}`}>{record.percentage}%</p>
                            </div>
                          </div>
                          <div className="relative w-full h-3 bg-gray-200/50 rounded-full overflow-hidden border border-gray-300/50">
                            <div className={`h-full ${colors.bar}`} style={{ width: `${Math.min(record.percentage, 100)}%` }} />
                            <div className="absolute top-0 bottom-0 w-1 bg-gray-900/30" style={{ left: '70%' }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'records' && (
                <div className="animate-in fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={18} className="text-gray-400" />
                    <h3 className="font-bold text-gray-800">Attendance History</h3>
                  </div>
                  <div className="space-y-3 max-h-100 overflow-y-auto pr-1">
                    {history?.map((h, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{h.course_code}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{new Date(h.created_at).toLocaleString()}</p>
                        </div>
                        {h.status === 'verified' ? (
                          <span className="bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Present</span>
                        ) : h.status === 'flagged' || h.status === 'pending_override' ? (
                          <span className="bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Flagged</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Absent</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'register' && (
                <div className="animate-in fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <Plus size={18} className="text-[#2563EB]" />
                    <h3 className="font-bold text-gray-800">Register for Courses</h3>
                  </div>
                  
                  {(!studentDept || !studentLevel) ? (
                    <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <p className="text-sm font-bold text-yellow-800">Please set your Department and Level in the Shield tab first.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {availableCourses.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 py-4">No new courses available for {studentDept} {studentLevel}.</p>
                      ) : (
                        availableCourses.map(course => (
                          <div key={course.id} className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{course.course_code}</p>
                              <p className="text-[10px] text-gray-500 font-medium">{course.department} • Level {course.level}</p>
                            </div>
                            <button 
                              onClick={() => handleEnroll(course.id, course.course_code)}
                              disabled={isEnrolling === course.id}
                              className="bg-[#2563EB] text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              {isEnrolling === course.id ? 'Joining...' : 'Enroll'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'feed' && (
                <div className="animate-in fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone size={18} className="text-[#2563EB]" />
                    <h3 className="font-bold text-gray-800">Campus Updates</h3>
                  </div>
                  <div className="space-y-4">
                    {feed.map((post) => (
                      <div key={post.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-extrabold text-gray-900 text-sm">{post.title}</h4>
                          {post.course_code && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{post.course_code}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed mb-2">{post.content}</p>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <Calendar size={10} /> {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {feed.length === 0 && <p className="text-sm text-gray-500 text-center">No updates yet.</p>}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setRecords(null); setHistory(null); }}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold text-sm py-3 rounded-xl hover:bg-gray-200 transition-all mt-6"
              >
                <Lock size={16} /> Lock Portal
              </button>
            </>
          )}
        </div>

        <div className="mt-8 text-center animate-in fade-in pb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
        </div>
      </div>
    </div>
  );
}