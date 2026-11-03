'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ShieldCheck, User, Lock, Megaphone, Zap, AlertTriangle, 
  Fingerprint, Bell, Loader2, ArrowLeft, BookOpen, CheckCircle
} from 'lucide-react';
import type { CampusUpdate } from '@/types/db';
import Link from 'next/link';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { ConfirmModal, useConfirmModal } from '@/components/ConfirmModal';
import { ToastContainer, useToast } from '@/components/Toast';
import { safeStorage } from '@/utils/safe-storage';
import { STORAGE_KEYS, PORTAL_UNLOCK_GRACE_MS } from '@/utils/constants';
import { usePushNotifications } from '@/utils/usePushNotifications';
import PWAInstaller from '@/components/PWAInstaller';
import ThemeToggle from '@/components/ThemeToggle';

import DashboardTab from '@/components/student-hub/DashboardTab';
import FeedTab from '@/components/student-hub/FeedTab';
import RepDeskTab from '@/components/student-hub/RepDeskTab';
import EnrollModal from '@/components/student-hub/EnrollModal';

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

const POLL_INTERVAL_MS = 15000;
const FEED_LAST_SEEN_KEY = 'campuscheck_feed_last_seen';
const getCurrentTimestamp = () => Date.now();

const TABS = [
  { id: 'dashboard' as const, label: 'Dashboard', Icon: Zap },
  { id: 'feed'      as const, label: 'Feed',      Icon: Megaphone },
  { id: 'rep'       as const, label: 'Rep Desk',  Icon: BookOpen },
];

type UnlockState = 'idle' | 'checking' | 'not_enrolled' | 'needs_setup' | 'authenticating' | 'unlocked';

export default function StudentPortal() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'feed' | 'rep'>('dashboard');
  const [matricNumber, setMatricNumber] = useState('');
  const [studentDept, setStudentDept] = useState('');
  const [studentLevel, setStudentLevel] = useState('');
  
  const [repCourseCodes, setRepCourseCodes] = useState<string[]>([]);
  const isClassRep = repCourseCodes.length > 0;
  
  const [unlockState, setUnlockState] = useState<UnlockState>('idle');
  const [unlockError, setUnlockError] = useState('');
  
  const [records, setRecords] = useState<CourseRecord[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [activeLiveSession, setActiveLiveSession] = useState<{ course: string, sessionId: string } | null>(null);
  const [liveSessionCheckedIn, setLiveSessionCheckedIn] = useState<boolean>(false);
  const [liveSessionCheckedInAt, setLiveSessionCheckedInAt] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [savedNickname, setSavedNickname] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  
  const [feed, setFeed] = useState<CampusUpdate[]>([]);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(0);
  const [now, setNow] = useState<number>(0);
  
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const confirm = useConfirmModal();
  const { toasts, addToast, removeToast } = useToast();
  const autoLoadAttempted = useRef(false);
  
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications(matricNumber);

  const fetchStudentData = useCallback(async (cleanMatric: string) => {
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

    const { data: feedData } = await supabase
      .from('campus_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (feedData) setFeed(feedData);

    const { data: enrollmentRows, error: enrollError } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('matric_number', cleanMatric);

    if (enrollError) throw enrollError;

    if (!enrollmentRows || enrollmentRows.length === 0) {
      setRecords([]);
      setRepCourseCodes([]);
      return;
    }

    const courseIds = enrollmentRows.map(e => e.course_id);

    const { data: courseRows, error: courseError } = await supabase
      .from('courses')
      .select('id, course_code, total_planned_classes, max_attendance_score, is_finalized')
      .in('id', courseIds);

    if (courseError) throw courseError;
    const courseCodes = courseRows?.map(c => c.course_code) || [];

    const { data: repRows } = await supabase
      .from('course_reps')
      .select('course_id')
      .eq('matric_number', cleanMatric);

    const myRepCourseIds = repRows?.map(r => r.course_id) || [];
    const myRepCourseCodes = courseRows?.filter(c => myRepCourseIds.includes(c.id)).map(c => c.course_code) || [];
    setRepCourseCodes(myRepCourseCodes);

    const { data: sessionRows, error: sessionError } = await supabase
      .from('lecture_sessions')
      .select('session_id, course_code, created_at, is_active, expires_at')
      .in('course_code', courseCodes)
      .order('created_at', { ascending: false });

    if (sessionError) throw sessionError;

    const nowTime = new Date().getTime();
    const liveSession = sessionRows?.find(s => {
      if (!s.is_active) return false;
      const isExpired = s.expires_at && new Date(s.expires_at).getTime() < nowTime;
      return !isExpired;
    });

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

    if (liveSession) {
      setActiveLiveSession({ course: liveSession.course_code, sessionId: liveSession.session_id });
      const existingLog = studentLogs.find(l => l.session_id === liveSession.session_id && l.status === 'verified');
      if (existingLog) {
        setLiveSessionCheckedIn(true);
        setLiveSessionCheckedInAt(liveSession.created_at);
      } else {
        setLiveSessionCheckedIn(false);
        setLiveSessionCheckedInAt(null);
      }
    } else {
      setActiveLiveSession(null);
      setLiveSessionCheckedIn(false);
      setLiveSessionCheckedInAt(null);
    }

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
  }, []);

  useEffect(() => {
    const saved = safeStorage.getString(STORAGE_KEYS.studentMatric);
    const lastUnlocked = safeStorage.getString('campuscheck_portal_unlocked_at');
    const lastUnlockedTime = lastUnlocked ? parseInt(lastUnlocked, 10) : 0;

    if (saved && Date.now() - lastUnlockedTime < PORTAL_UNLOCK_GRACE_MS && !autoLoadAttempted.current) {
      autoLoadAttempted.current = true;
      const id = setTimeout(() => {
        setMatricNumber(saved);
        setUnlockState('authenticating');
        fetchStudentData(saved.toUpperCase().trim())
          .then(() => setUnlockState('unlocked'))
          .catch(() => setUnlockState('idle'));
      }, 0);
      return () => clearTimeout(id);
    } else if (saved) {
      const id = setTimeout(() => { setMatricNumber(saved); }, 0);
      return () => clearTimeout(id);
    }
  }, [fetchStudentData]);

  useEffect(() => {
    if (!records) return;

    const checkLockTimer = () => {
      const lastUnlocked = safeStorage.getString('campuscheck_portal_unlocked_at');
      const lastUnlockedTime = lastUnlocked ? parseInt(lastUnlocked, 10) : 0;
      
      if (Date.now() - lastUnlockedTime >= PORTAL_UNLOCK_GRACE_MS) {
        safeStorage.remove('campuscheck_portal_unlocked_at');
        setRecords(null);
        setHistory(null);
        setNickname('');
        setSavedNickname('');
        setUnlockState('idle');
        setUnlockError('Your hub session expired for security reasons. Please unlock again.');
      }
    };

    const interval = setInterval(checkLockTimer, 30000);
    return () => clearInterval(interval);
  }, [records]);

  useEffect(() => {
    const saved = safeStorage.getString(FEED_LAST_SEEN_KEY);
    const id = setTimeout(() => {
      setLastSeenTimestamp(saved ? parseInt(saved, 10) || 0 : 0);
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!activeLiveSession) return;

    const checkSessionStatus = async () => {
      const { data, error } = await supabase
        .from('lecture_sessions')
        .select('is_active, expires_at')
        .eq('session_id', activeLiveSession.sessionId)
        .single();

      if (error || !data) {
        setActiveLiveSession(null);
        return;
      }

      const isExpired = data.expires_at && new Date(data.expires_at).getTime() < Date.now();
      if (!data.is_active || isExpired) {
        setActiveLiveSession(null);
        if (matricNumber) {
          fetchStudentData(matricNumber.toUpperCase().trim());
        }
      }
    };

    const intervalId = setInterval(checkSessionStatus, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [activeLiveSession, matricNumber, fetchStudentData]);

  useEffect(() => {
    if (activeTab === 'feed' && feed.length > 0) {
      const currentTime = Date.now();
      safeStorage.setString(FEED_LAST_SEEN_KEY, String(currentTime));
      const id = setTimeout(() => {
        setLastSeenTimestamp(currentTime);
        setNow(currentTime);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [activeTab, feed]);

  const unreadCount = useMemo(() => {
    return feed.filter(post => {
      const postTime = new Date(post.created_at).getTime();
      return postTime > lastSeenTimestamp && postTime <= now;
    }).length;
  }, [feed, lastSeenTimestamp, now]);

  const totalXP = useMemo(() => {
    if (!records) return 0;
    return records.reduce((acc, record) => {
      return acc + (record.attended_classes * 10) + (record.streak * 5);
    }, 0);
  }, [records]);

  const levelData = useMemo(() => {
    if (totalXP <= 500) return { level: 1, title: 'Rookie', currentXP: totalXP, nextLevelXP: 500 };
    if (totalXP <= 1500) return { level: 2, title: 'Regular', currentXP: totalXP - 500, nextLevelXP: 1000 };
    if (totalXP <= 3000) return { level: 3, title: 'Scholar', currentXP: totalXP - 1500, nextLevelXP: 1500 };
    return { level: 4, title: 'Legend', currentXP: totalXP - 3000, nextLevelXP: 9999 };
  }, [totalXP]);

  const handleRegister = async () => {
    if (matricNumber.length < 5) return;
    setUnlockState('authenticating');
    setUnlockError('');

    const cleanMatric = matricNumber.toUpperCase().trim();

    try {
      const genRes = await fetch('/api/webauthn/register/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric })
      });

      const options = await genRes.json();
      if (!genRes.ok) {
        if (options.error === 'NOT_ENROLLED') {
          setUnlockState('not_enrolled');
          setUnlockError(options.message || "Your matric isn't on any roster yet.");
          return;
        }
        if (options.error === 'ALREADY_REGISTERED') {
          await handleVerifyAndFetch();
          return;
        }
        throw new Error(options.error || "Registration failed.");
      }

      const attResp = await startRegistration(options);
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric, authResponse: attResp })
      });
      const verifyResult = await verifyRes.json();

      if (!verifyResult.verified) throw new Error("Biometric registration failed.");

      safeStorage.setString(STORAGE_KEYS.studentMatric, cleanMatric);
      safeStorage.setString('campuscheck_portal_unlocked_at', String(getCurrentTimestamp()));

      if (verifyResult.token) {
        safeStorage.setSessionString(STORAGE_KEYS.studentJwt, verifyResult.token);
      }

      await fetchStudentData(cleanMatric);
      setUnlockState('unlocked');

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      setUnlockError(msg);
      setUnlockState('needs_setup');
    }
  };

  const handleVerifyAndFetch = async () => {
    if (matricNumber.length < 5) return;
    setUnlockState('authenticating');
    setUnlockError('');
    setRecords(null);
    setHistory(null);
    setActiveLiveSession(null);
    setRepCourseCodes([]);

    const cleanMatric = matricNumber.toUpperCase().trim();
    safeStorage.setString(STORAGE_KEYS.studentMatric, cleanMatric);

    try {
      const genRes = await fetch('/api/webauthn/auth/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric })
      });

      const options = await genRes.json();

      if (!genRes.ok) {
        if (options.error === 'NOT_ENROLLED') {
          setUnlockState('not_enrolled');
          setUnlockError(options.message || "Your matric isn't on any class roster yet.");
          return;
        }
        if (options.error === 'NEEDS_SETUP') {
          setUnlockState('needs_setup');
          return;
        }
        throw new Error(options.message || options.error || "Login failed.");
      }

      const asseResp = await startAuthentication(options);
      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric, authResponse: asseResp })
      });

      const verifyResult = await verifyRes.json();
      if (!verifyResult.verified) throw new Error("Biometric verification failed.");

      if (verifyResult.token) {
        safeStorage.setSessionString(STORAGE_KEYS.studentJwt, verifyResult.token);
      }

      safeStorage.setString('campuscheck_portal_unlocked_at', String(getCurrentTimestamp()));
      await fetchStudentData(cleanMatric);
      setUnlockState('unlocked');

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      setUnlockError(msg);
      setUnlockState('idle');
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
    });

    if (error) {
      addToast('Profile save failed', error.message, 'error');
      return;
    }

    setSavedNickname(nickname.trim());
    setIsEditingNickname(false);
    addToast('Profile updated', 'Your changes have been saved.', 'success');
  };

  const renderUnlockForm = () => {
    if (unlockState === 'not_enrolled') {
      return (
        <div className="space-y-4 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-100 dark:border-red-800">
            <AlertTriangle className="text-red-600 dark:text-red-500" size={32} />
          </div>
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Not on any roster yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
            Your matric <span className="font-black text-gray-900 dark:text-white">{matricNumber}</span> isn&apos;t enrolled in any course yet.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-left">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2">What to do:</p>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
              Ask your lecturer to upload the class roster with your matric number. Once they do, come back here and try again.
            </p>
          </div>
          <button onClick={() => { setUnlockState('idle'); setUnlockError(''); }} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
            Try a Different Matric
          </button>
        </div>
      );
    }

    if (unlockState === 'needs_setup') {
      return (
        <div className="space-y-4 text-center animate-in fade-in">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-800">
            <Fingerprint className="text-[#2563EB] dark:text-blue-400" size={32} />
          </div>
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Let&apos;s set up this phone</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
            We&apos;ll link this phone to <span className="font-black text-gray-900 dark:text-white">{matricNumber}</span> so only you can check in from it.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-lg">📱</span>
              <p className="text-xs text-blue-900 dark:text-blue-300 font-medium">One-time setup — you won&apos;t do this again on this phone.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🔒</span>
              <p className="text-xs text-blue-900 dark:text-blue-300 font-medium">Your fingerprint never leaves your device. We only store a security key.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🔄</span>
              <p className="text-xs text-blue-900 dark:text-blue-300 font-medium">Changing phones later? Ask your lecturer to reset your device.</p>
            </div>
          </div>

          {unlockError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
              <p className="text-red-700 dark:text-red-400 font-bold text-sm">{unlockError}</p>
            </div>
          )}

          <button onClick={handleRegister} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
            <Fingerprint size={20} /> Link This Phone
          </button>
          <button onClick={() => { setUnlockState('idle'); setUnlockError(''); }} className="w-full text-gray-500 dark:text-gray-400 font-bold py-2 hover:text-gray-800 dark:hover:text-white transition-all text-sm">
            Cancel
          </button>
        </div>
      );
    }

    if (unlockState === 'authenticating') {
      return (
        <div className="py-8 flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-[#2563EB] dark:text-blue-400 animate-spin mb-4" />
          <p className="text-gray-700 dark:text-gray-300 font-bold text-center">Verifying...</p>
        </div>
      );
    }

    return (
      <>
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400 dark:text-gray-500" /></div>
          <input 
            aria-label="Matric Number"
            type="text" 
            placeholder="Matric Number (e.g. CSC/2021/001)" 
            value={matricNumber} 
            onChange={(e) => setMatricNumber(e.target.value.toUpperCase())} 
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyAndFetch()} 
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500" 
          />
        </div>
        
        <button onClick={handleVerifyAndFetch} disabled={matricNumber.length < 5} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70">
          <Lock size={20} /> Unlock Hub
        </button>

        <div className="mt-6 text-center">
          <Link href="/onboard" className="text-sm font-bold text-[#2563EB] dark:text-blue-400 hover:underline">
            First time? Set up your device here.
          </Link>
        </div>

        {unlockError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 text-center animate-in fade-in">
            <p className="text-red-700 dark:text-red-400 font-bold text-sm">{unlockError}</p>
          </div>
        )}
      </>
    );
  };

  const visibleTabs = TABS.filter(t => t.id !== 'rep' || isClassRep);
  const repRecords = records?.filter(r => repCourseCodes.includes(r.course_code)) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center p-4 sm:p-6 font-sans relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 pt-4">
        
        <div className="text-center mb-6 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 relative">
          
          {records && (
            <div className="absolute top-0 right-0 flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setActiveTab('feed')}
                aria-label={unreadCount > 0 ? `${unreadCount} unread updates` : 'Open updates feed'}
                className="relative w-10 h-10 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all"
              >
                <Bell size={18} className={unreadCount > 0 ? 'text-[#2563EB] dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-gray-900 animate-in zoom-in duration-200">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          <div className="bg-[#2563EB] w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 relative overflow-hidden">
            <ShieldCheck className="w-7 h-7 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {savedNickname ? `Welcome back, ${savedNickname}` : 'Student Hub'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium text-base">Monitor your attendance & eligibility</p>
        </div>

        {activeLiveSession && (
          liveSessionCheckedIn ? (
            <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-500 shadow-sm">
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Class is live: {activeLiveSession.course}</p>
                <p className="font-bold text-emerald-900 dark:text-emerald-300">You&apos;re checked in.</p>
                {liveSessionCheckedInAt && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-semibold">
                    Marked present at {new Date(liveSessionCheckedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                  </p>
                )}
              </div>
            </div>
          ) : (
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
          )
        )}

        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-white dark:border-gray-800 p-6 animate-in fade-in slide-in-from-bottom-6 transition-colors duration-300">
          
          {!records && renderUnlockForm()}

          {records && (
            <>
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6 overflow-x-auto gap-1 transition-colors">
                {visibleTabs.map(({ id, label, Icon }) => {
                  const isActive = activeTab === id;
                  const hasBadge = id === 'feed' && unreadCount > 0;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap relative ${
                        isActive
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      <div className="relative">
                        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        {hasBadge && (
                          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white dark:border-gray-800 animate-in zoom-in duration-200" />
                        )}
                      </div>
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>

              {activeTab === 'dashboard' && (
                <DashboardTab 
                  records={records}
                  history={history}
                  nickname={nickname}
                  setNickname={setNickname}
                  savedNickname={savedNickname}
                  isEditingNickname={isEditingNickname}
                  setIsEditingNickname={setIsEditingNickname}
                  studentDept={studentDept}
                  setStudentDept={setStudentDept}
                  studentLevel={studentLevel}
                  setStudentLevel={setStudentLevel}
                  saveProfile={saveProfile}
                  setShowEnrollModal={setShowEnrollModal}
                  isSupported={isSupported}
                  permission={permission}
                  isSubscribed={isSubscribed}
                  subscribe={subscribe}
                  totalXP={totalXP}
                  levelData={levelData}
                />
              )}

              {activeTab === 'feed' && (
                <FeedTab 
                  feed={feed} 
                  lastSeenTimestamp={lastSeenTimestamp} 
                />
              )}

              {activeTab === 'rep' && isClassRep && (
                <RepDeskTab 
                  records={repRecords}
                  matricNumber={matricNumber}
                  activeLiveSession={activeLiveSession}
                  onRefresh={() => fetchStudentData(matricNumber.toUpperCase().trim())}
                  addToast={addToast}
                />
              )}

              <button
                onClick={() =>
                  confirm.ask(
                    'Lock the hub?',
                    'You will need your biometrics again to unlock.',
                    () => {
                      safeStorage.remove('campuscheck_portal_unlocked_at');
                      setRecords(null);
                      setHistory(null);
                      setNickname('');
                      setSavedNickname('');
                      setUnlockState('idle');
                    },
                    { isDangerous: false, confirmLabel: 'Lock' }
                  )
                }
                className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all mt-6"
              >
                <Lock size={16} /> Lock Hub
              </button>
            </>
          )}
        </div>

        <div className="mt-8 text-center animate-in fade-in pb-8 space-y-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
          <div className="flex justify-center items-center gap-3 text-xs font-bold text-gray-400 dark:text-gray-500">
            <Link href="/guide" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">User Guide</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      <EnrollModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        matricNumber={matricNumber}
        studentDept={studentDept}
        studentLevel={studentLevel}
        onEnrolled={() => fetchStudentData(matricNumber.toUpperCase().trim())}
        addToast={addToast}
      />

      <PWAInstaller />
      <ConfirmModal config={confirm.config} onClose={confirm.close} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}