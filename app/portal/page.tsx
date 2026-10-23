'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';
import { 
  ShieldCheck, User, Clock, ArrowLeft, Lock,
  Megaphone, Calendar, Edit3, Save, FileText, Plus, CheckCircle, Zap, ChevronDown, AlertTriangle, Upload, PlayCircle, MapPin, BookOpen, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';

interface CourseRecord {
  course_code: string;
  total_held: number;
  total_planned: number;
  attended_classes: number;
  percentage: number;
  skips_left: number;
  streak: number;
  streak_tier: 'JJC' | 'Consistent' | 'Odogwu' | 'None';
  is_finalized: boolean;
  ca_score: string | null;
  max_score: number;
  active_session_id: string | null;
}

interface LogRow { session_id: string; status: string; }
interface SessionRow { session_id: string; course_code: string; created_at: string; is_active: boolean; expires_at: string | null; }
interface HistoryRow extends SessionRow { status: string; }
interface CampusUpdate { id: string; title: string; content: string; author: string; course_code: string | null; created_at: string; }
interface AvailableCourse { id: string; course_code: string; department: string; level: string; }

const DEPARTMENTS = ['CSC', 'MTH', 'PHY', 'CHM', 'BIO', 'ENG', 'LAW', 'MED', 'AGR', 'ECO'];
const LEVELS = ['100', '200', '300', '400', '500'];
const MATRIC_REGEX = /[\/\-]/;

export default function StudentPortal() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'feed' | 'register' | 'rep'>('dashboard');
  
  const [matricNumber, setMatricNumber] = useState('');
  const [studentDept, setStudentDept] = useState('');
  const [studentLevel, setStudentLevel] = useState('');
  const [isClassRep, setIsClassRep] = useState(false);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [records, setRecords] = useState<CourseRecord[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState('');
  const [activeLiveSession, setActiveLiveSession] = useState<{ course: string, sessionId: string } | null>(null);

  const [nickname, setNickname] = useState('');
  const [savedNickname, setSavedNickname] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [feed, setFeed] = useState<CampusUpdate[]>([]);
  
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [isEnrolling, setIsEnrolling] = useState<string | null>(null);

  // Rep Desk State
  const [repCourseId, setRepCourseId] = useState('');
  const [repBatteryMatric, setRepBatteryMatric] = useState('');
  const [isLoggingBattery, setIsLoggingBattery] = useState(false);
  const [isUploadingList, setIsUploadingList] = useState(false);

  // Backup Anchor State
  const [isStartingRepSession, setIsStartingRepSession] = useState(false);
  const [repSessionError, setRepSessionError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('campuscheck_student_matric');
    if (saved) {
      const id = setTimeout(() => { setMatricNumber(saved); }, 0);
      return () => clearTimeout(id);
    }
  }, []);

  const fetchStudentData = async (cleanMatric: string) => {
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('nickname, department, level, is_class_rep')
      .eq('matric_number', cleanMatric)
      .maybeSingle();

    console.log("DB Profile Fetch:", profile, profileError);

    if (profile?.nickname) {
      setNickname(profile.nickname);
      setSavedNickname(profile.nickname);
    }
    if (profile?.department) setStudentDept(profile.department);
    if (profile?.level) setStudentLevel(profile.level);
    
    if (profile?.is_class_rep === true) {
      setIsClassRep(true);
    }

    const { data: feedData } = await supabase
      .from('campus_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (feedData) setFeed(feedData);

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
      .select('id, course_code, total_planned_classes, max_attendance_score, is_finalized')
      .in('id', courseIds);

    if (courseError) throw courseError;
    const courseCodes = courseRows?.map(c => c.course_code) || [];
    
    if (courseRows && courseRows.length > 0) setRepCourseId(courseRows[0].id);

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
    
    if (liveSession) {
      setActiveLiveSession({ course: liveSession.course_code, sessionId: liveSession.session_id });
    }

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

    const courseStats = new Map<string, { total_held: number; total_planned: number; attended: number; sessions: SessionRow[]; is_finalized: boolean; max_score: number }>();
    
    courseRows?.forEach(c => {
      courseStats.set(c.course_code, { 
        total_held: 0, 
        total_planned: c.total_planned_classes || 15, 
        attended: 0, 
        sessions: [],
        is_finalized: c.is_finalized,
        max_score: c.max_attendance_score || 10
      });
    });

    (sessionRows as SessionRow[] || []).forEach(session => {
      const course = session.course_code;
      const stats = courseStats.get(course);
      if (stats) {
        stats.total_held += 1;
        stats.sessions.push(session);
        if (logStatusMap.get(session.session_id) === 'verified') stats.attended += 1;
        courseStats.set(course, stats);
      }
    });

    const finalRecords: CourseRecord[] = [];
    courseStats.forEach((stats, course) => {
      const total_held = stats.total_held;
      const attended = stats.attended;
      
      const denominator = stats.is_finalized 
        ? Math.min(stats.total_planned, total_held > 0 ? total_held : 1)
        : (stats.total_planned > 0 ? stats.total_planned : (total_held > 0 ? total_held : 1));

      const percentage = Math.round((attended / denominator) * 100);
      const maxAbsences = Math.floor(denominator * 0.30);
      const currentAbsences = denominator - attended;
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

      const ca_score = stats.is_finalized ? ((attended / denominator) * stats.max_score).toFixed(1) : null;
      const activeSessionId = liveSession?.course_code === course ? liveSession.session_id : null;

      finalRecords.push({
        course_code: course, 
        total_held, 
        total_planned: denominator,
        attended_classes: attended,
        percentage, 
        skips_left: skipsLeft, 
        streak, 
        streak_tier: tier,
        is_finalized: stats.is_finalized,
        ca_score,
        max_score: stats.max_score,
        active_session_id: activeSessionId
      });
    });

    finalRecords.sort((a, b) => a.course_code.localeCompare(b.course_code));
    setRecords(finalRecords);
  };

  const handleVerifyAndFetch = async () => {
    if (matricNumber.length < 5) return;
    setIsVerifying(true);
    setError('');
    setRecords(null);
    setHistory(null);
    setActiveLiveSession(null);
    setIsClassRep(false);

    const cleanMatric = matricNumber.toUpperCase().trim();
    localStorage.setItem('campuscheck_student_matric', cleanMatric);

    try {
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

      await fetchStudentData(cleanMatric);

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
    const cleanMatric = matricNumber.toUpperCase().trim();
    
    const { error } = await supabase.from('student_profiles').upsert({
      matric_number: cleanMatric,
      nickname: nickname.trim(),
      department: studentDept,
      level: studentLevel,
      is_class_rep: isClassRep 
    });

    if (error) {
      alert("Failed to save profile: " + error.message);
      console.error("Profile save error:", error);
      return;
    }

    setSavedNickname(nickname.trim());
    setIsEditingNickname(false);
    fetchAvailableCourses();
  };

  const fetchAvailableCourses = useCallback(async () => {
    if (!studentDept || !studentLevel) return;
    
    const { data: allCourses } = await supabase
      .from('courses')
      .select('id, course_code, department, level')
      .eq('department', studentDept)
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

  const handleLogBattery = async () => {
    if (!activeLiveSession) return alert("No active lecture right now.");
    if (!repBatteryMatric.trim()) return alert("Enter the student's matric number.");
    
    setIsLoggingBattery(true);
    try {
      const res = await fetch('/api/rep-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_dead_battery',
          sessionId: activeLiveSession.sessionId,
          matricNumber: repBatteryMatric,
          repMatric: matricNumber
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Logged! Ask the student to see the lecturer for approval.");
        setRepBatteryMatric('');
      } else {
        alert(data.error || "Failed to log battery dead.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setIsLoggingBattery(false);
    }
  };

  const handleRepUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !repCourseId) return;
    setIsUploadingList(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let rawMatrics: string[] = [];

        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
          
          jsonData.forEach(row => {
            row.forEach(cell => {
               if (typeof cell === 'string' && cell.length > 5 && MATRIC_REGEX.test(cell) && !cell.includes('MATRIC')) {
                 rawMatrics.push(cell.trim().toUpperCase());
               }
            });
          });
        } else {
          const csvText = event.target?.result as string;
          const cleanMatrics = csvText
            .split(/[\n,]+/)
            .map(m => m.trim().toUpperCase())
            .filter(m => m.length > 5 && MATRIC_REGEX.test(m) && !m.includes('MATRIC'));
          rawMatrics = cleanMatrics;
        }

        const uniqueMatrics = Array.from(new Set(rawMatrics));
        if (uniqueMatrics.length === 0) {
          alert("No valid matric numbers found.");
          setIsUploadingList(false);
          e.target.value = '';
          return;
        }

        const rows = uniqueMatrics.map(matric => ({
          course_id: repCourseId,
          matric_number: matric,
        }));

        const { error } = await supabase
          .from('enrollments')
          .upsert(rows, { onConflict: 'course_id,matric_number', ignoreDuplicates: true });

        if (!error) {
          alert(`Success! ${uniqueMatrics.length} students synced.`);
          handleVerifyAndFetch();
        } else {
          alert(`Upload failed: ${error.message}`);
        }
      } catch {
        alert("Failed to read file.");
      }
      
      setIsUploadingList(false);
      e.target.value = '';
    };
    
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleStartBackupSession = async () => {
    if (!repCourseId) return alert("Select a course first.");
    if (!navigator.geolocation) return alert("Your phone doesn't support GPS.");

    const course = records?.find(r => r.course_code === repCourseId);
    if (!course) return;

    if (!window.confirm(`Start a backup session for ${course.course_code}? Your phone will become the GPS anchor.`)) return;

    setIsStartingRepSession(true);
    setRepSessionError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch('/api/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseCode: course.course_code,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              duration: 60, 
              checkinOpensAfter: 0, 
              startedBy: 'Class Rep'
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to start session");

          alert("✅ Backup session started! Students can now check in.");
          handleVerifyAndFetch(); 
        } catch (err) {
          setRepSessionError(err instanceof Error ? err.message : "Failed to start session.");
        } finally {
          setIsStartingRepSession(false);
        }
      },
      () => {
        setRepSessionError("Could not get GPS. Ensure location is on.");
        setIsStartingRepSession(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
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
          <p className="text-gray-500 mt-1 font-medium text-base">Track your NUC clearance status</p>
        </div>

        {activeLiveSession && (
          <a 
            href={`/?sessionId=${activeLiveSession.sessionId}&matric=${matricNumber}`}
            className="mb-6 bg-green-600 text-white p-4 rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-between animate-in slide-in-from-top-4 fade-in duration-500 hover:bg-green-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full animate-pulse"><Zap size={20} /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-green-100">Live Class Now</p>
                <p className="font-extrabold text-lg">{activeLiveSession.course}</p>
              </div>
            </div>
            <span className="text-sm font-black bg-white text-green-700 px-3 py-1.5 rounded-lg shadow-sm">
              Tap to Check In
            </span>
          </a>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-4xl shadow-xl shadow-gray-200/50 border border-white p-6 animate-in fade-in slide-in-from-bottom-6">
          
          {!records && (
            <>
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
                {/* ACCESSIBILITY FIX: Added aria-label */}
                <input 
                  aria-label="Matric Number"
                  type="text" 
                  placeholder="Matric Number (e.g. CSC/2021/001)" 
                  value={matricNumber} 
                  onChange={(e) => setMatricNumber(e.target.value.toUpperCase())} 
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyAndFetch()} 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium" 
                />
              </div>
              
              <button onClick={handleVerifyAndFetch} disabled={matricNumber.length < 5 || isVerifying} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70">
                {isVerifying ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
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
                <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Status</button>
                <button onClick={() => setActiveTab('records')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'records' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Records</button>
                <button onClick={() => setActiveTab('register')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'register' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Enroll</button>
                <button onClick={() => setActiveTab('feed')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'feed' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Feed</button>
                
                {isClassRep && (
                  <button onClick={() => setActiveTab('rep')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap border border-blue-200 ${activeTab === 'rep' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}>Rep Desk</button>
                )}
              </div>

              {activeTab === 'dashboard' && (
                <div className="space-y-5 animate-in fade-in">
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Profile:</span>
                        {isEditingNickname ? (
                          <input aria-label="Nickname" type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="bg-white border border-blue-200 rounded px-2 py-1 text-base font-bold text-gray-900 outline-none w-24" placeholder="Nickname" maxLength={15} />
                        ) : (
                          <span className="text-base font-black text-blue-900">{savedNickname || 'Not set'}</span>
                        )}
                      </div>
                      {isEditingNickname ? (
                        <button aria-label="Save Profile" onClick={saveProfile} className="text-blue-600 hover:text-blue-800"><Save size={18} /></button>
                      ) : (
                        <button aria-label="Edit Profile" onClick={() => setIsEditingNickname(true)} className="text-blue-500 hover:text-blue-700"><Edit3 size={18} /></button>
                      )}
                    </div>
                    
                    {isEditingNickname && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-200">
                        <div className="relative">
                          <select aria-label="Department" value={studentDept} onChange={e => setStudentDept(e.target.value)} className="bg-white border border-blue-200 rounded px-2 py-2 text-sm font-bold text-gray-900 outline-none w-full appearance-none cursor-pointer">
                            <option value="">Select Dept</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <select aria-label="Level" value={studentLevel} onChange={e => setStudentLevel(e.target.value)} className="bg-white border border-blue-200 rounded px-2 py-2 text-sm font-bold text-gray-900 outline-none w-full appearance-none cursor-pointer">
                            <option value="">Select Level</option>
                            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {records.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                      <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                        <BookOpen size={32} className="text-gray-400" />
                      </div>
                      <p className="text-base font-bold text-gray-600">You have no courses yet.</p>
                      <button onClick={() => setActiveTab('register')} className="bg-[#2563EB] text-white font-bold text-sm px-6 py-2 rounded-xl shadow-md hover:bg-blue-700 transition-all">Enroll in a Course</button>
                    </div>
                  ) : (
                    records.map((record) => {
                      const colors = getShieldColor(record.percentage);
                      return (
                        <div key={record.course_code} className={`relative overflow-hidden ${colors.bg} p-4 rounded-2xl border ${colors.border}`}>
                          {record.is_finalized && (
                            <div className="absolute top-0 right-0 bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                              <CheckCircle size={10} /> FINALIZED
                            </div>
                          )}

                          <div className="flex justify-between items-start mb-3 mt-1">
                            <div>
                              <p className="font-black text-gray-900 text-lg">{record.course_code}</p>
                              <p className="text-xs text-gray-600 font-semibold mt-0.5">
                                {record.attended_classes} / {record.total_planned} Classes
                                {record.total_held < record.total_planned && !record.is_finalized && ` (${record.total_planned - record.total_held} remaining)`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-black text-2xl ${colors.text}`}>{record.percentage}%</p>
                              {record.is_finalized && (
                                <p className="text-sm font-bold text-gray-700 mt-1 bg-white/50 px-2 py-0.5 rounded border border-gray-200">
                                  CA: {record.ca_score} / {record.max_score}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="relative w-full h-3 bg-gray-200/50 rounded-full overflow-hidden border border-gray-300/50">
                            <div className={`h-full ${colors.bar}`} style={{ width: `${Math.min(record.percentage, 100)}%` }} />
                            <div className="absolute top-0 bottom-0 w-1 bg-gray-900/30" style={{ left: '70%' }} />
                          </div>
                          
                          {!record.is_finalized && (
                             <div className="mt-2 flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                               <span>{record.streak} Streak ({record.streak_tier})</span>
                               <span>{record.skips_left} Safe Skips Left</span>
                             </div>
                          )}
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
                    <h3 className="font-bold text-gray-800 text-base">Attendance History</h3>
                  </div>
                  <div className="space-y-3 max-h-100 overflow-y-auto pr-1">
                    {history?.map((h, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{h.course_code}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{new Date(h.created_at).toLocaleString()}</p>
                        </div>
                        {h.status === 'verified' ? (
                          <span className="bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Present</span>
                        ) : h.status === 'flagged' || h.status === 'pending_override' ? (
                          <span className="bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Flagged</span>
                        ) : h.status === 'blocked' ? (
                          <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Blocked</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Absent</span>
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
                    <h3 className="font-bold text-gray-800 text-base">Enroll in Class</h3>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 font-medium leading-relaxed">
                      <strong>Please note:</strong> Enrolling here only links you to your lecturer&apos;s attendance roster. It does <strong>NOT</strong> replace your official university course registration.
                    </p>
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
                          <div key={course.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{course.course_code}</p>
                              <p className="text-[10px] text-gray-500 font-medium">{course.department} • Level {course.level}</p>
                            </div>
                            <button 
                              onClick={() => handleEnroll(course.id, course.course_code)}
                              disabled={isEnrolling === course.id}
                              className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                    <h3 className="font-bold text-gray-800 text-base">Campus Updates</h3>
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
                        <p className="text-sm text-gray-600 leading-relaxed mb-2">{post.content}</p>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <Calendar size={10} /> {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {feed.length === 0 && <p className="text-sm text-gray-500 text-center">No updates yet.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'rep' && isClassRep && (
                <div className="animate-in fade-in space-y-6">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                    <h3 className="font-bold text-blue-900 text-base mb-2 flex items-center gap-2"><Upload size={18}/> Upload Class List</h3>
                    <p className="text-sm text-blue-700 font-medium mb-3">Help the lecturer by uploading the roster for a course you represent.</p>
                    
                    <select aria-label="Course to Upload List" value={repCourseId} onChange={(e) => setRepCourseId(e.target.value)} className="w-full bg-white border border-blue-200 p-3 rounded-lg text-sm font-bold mb-3">
                      {records?.map(r => <option key={r.course_code} value={r.course_code}>{r.course_code}</option>)}
                    </select>

                    <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-3 bg-white border border-blue-300 rounded-xl font-bold text-sm text-blue-700 hover:bg-blue-100 transition-all shadow-sm">
                      {isUploadingList ? <Clock size={18} className="animate-spin" /> : <FileText size={18} />}
                      {isUploadingList ? "Uploading..." : "Select CSV / Excel File"}
                      <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleRepUpload} disabled={isUploadingList} />
                    </label>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                    <h3 className="font-bold text-amber-900 text-base mb-2 flex items-center gap-2"><Zap size={18}/> Log Dead Battery</h3>
                    <p className="text-sm text-amber-700 font-medium mb-3">If a student&apos;s phone died, log their matric number here. <strong>Limit: 3 per class.</strong></p>
                    
                    <div className="flex gap-2">
                      <input aria-label="Student Matric Number for Dead Battery" type="text" placeholder="Student's Matric No." value={repBatteryMatric} onChange={(e) => setRepBatteryMatric(e.target.value.toUpperCase())} className="w-full bg-white border border-amber-200 p-3 rounded-lg text-sm font-bold uppercase" />
                      <button onClick={handleLogBattery} disabled={isLoggingBattery || !repBatteryMatric} className="bg-amber-500 text-white px-5 py-3 rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap">
                        {isLoggingBattery ? "Logging..." : "Log"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                    <h3 className="font-bold text-red-900 text-base mb-2 flex items-center gap-2"><PlayCircle size={18}/> Backup Anchor</h3>
                    <p className="text-sm text-red-700 font-medium mb-3">
                      If the lecturer&apos;s phone is dead or missing, start a session from your phone. Your GPS becomes the anchor for the class.
                    </p>

                    {activeLiveSession ? (
                       <div className="bg-white border border-red-200 p-3 rounded-lg text-center text-sm font-bold text-red-600">
                         Session already active: {activeLiveSession.course}
                       </div>
                    ) : (
                      <div className="space-y-2">
                        <select aria-label="Course for Backup Session" value={repCourseId} onChange={(e) => setRepCourseId(e.target.value)} className="w-full bg-white border border-red-200 p-3 rounded-lg text-sm font-bold">
                          {records?.map(r => <option key={r.course_code} value={r.course_code}>{r.course_code}</option>)}
                        </select>
                        <button onClick={handleStartBackupSession} disabled={isStartingRepSession} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                          {isStartingRepSession ? <Clock size={18} className="animate-spin" /> : <MapPin size={18} />}
                          {isStartingRepSession ? "Anchoring GPS..." : "Start Backup Session"}
                        </button>
                        {repSessionError && <p className="text-xs text-red-600 font-bold mt-2">{repSessionError}</p>}
                      </div>
                    )}
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