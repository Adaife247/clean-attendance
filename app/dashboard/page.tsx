'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { ConfirmModal, useConfirmModal } from '@/components/ConfirmModal';
import {
  Clock, CheckCircle, AlertTriangle, ShieldCheck,
  RefreshCw, UserPlus, Download, MapPin, Copy, XCircle,
  User, ChevronDown, Archive, Hand, Trash2, Timer, Lock, FileText, Navigation, Wifi, ShieldAlert, BookOpen, Search
} from 'lucide-react';

interface Log { 
  id: string; 
  matricNumber: string; 
  nickname?: string; 
  status: string; 
  time: string; 
  reason?: string; 
  isBiometric?: boolean;
}
interface DashboardData { 
  course: string; 
  isActive: boolean; 
  logs: Log[]; 
  startedBy?: string; 
  hiddenDisqualifiedCount?: number;
}
interface LecturerProfile { full_name: string; department: string; }
interface Course { id: string; course_code: string; }
interface PastSession { session_id: string; created_at: string; course_code: string; verified_count: number; flagged_count: number; }

const ANCHOR_CACHE_KEY = 'campuscheck_anchor_cache';
const ANCHOR_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const ACTIVE_SESSION_KEY = 'active_attendance_session';
const SESSION_EXPIRY_POLL_MS = 30000;

export default function LecturerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isUpdatingGeofence, setIsUpdatingGeofence] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [expiredMessage, setExpiredMessage] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);

  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [checkinOpensAfter, setCheckinOpensAfter] = useState<number>(10);

  const [manualMatric, setManualMatric] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
  const [ledgerTab, setLedgerTab] = useState<'verified' | 'flagged'>('verified');
  
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [viewingPastSession, setViewingPastSession] = useState<PastSession | null>(null);
  const [pastSessionLogs, setPastSessionLogs] = useState<Log[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const prewarmWatchRef = useRef<number | null>(null);
  const prewarmPosRef = useRef<{ lat: number; lng: number; acc: number; ts: number } | null>(null);
  const isFetchingRef = useRef(false);

  const confirm = useConfirmModal();

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    };
  };

  const clearStaleSession = useCallback((reason?: string) => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    setActiveSessionId(null);
    setData(null);
    setSetupError('');
    if (reason) setExpiredMessage(reason);
  }, []);

  useEffect(() => {
    const securePageAndFetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      
      const { data: profileData } = await supabase.from('lecturers').select('full_name, department').eq('id', session.user.id).single();
      if (profileData) setProfile({ full_name: profileData.full_name, department: profileData.department });

      const { data: courseData } = await supabase.from('courses').select('id, course_code').eq('lecturer_id', session.user.id).order('created_at', { ascending: false });
      if (courseData) {
        setCourses(courseData);
        if (courseData.length > 0) setSelectedCourseId(courseData[0].id);
      }
    };
    const id = setTimeout(() => { securePageAndFetchProfile(); }, 0);
    return () => clearTimeout(id);
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      const savedSession = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!savedSession) return;

      const { data } = await supabase.from('lecture_sessions').select('is_active, expires_at').eq('session_id', savedSession).single();

      if (!data) {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        return;
      }

      const isExpired = data.expires_at && new Date(data.expires_at).getTime() < Date.now();

      if (data.is_active && !isExpired) {
        setActiveSessionId(savedSession);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
        if (isExpired) setExpiredMessage('The previous session expired while you were away.');
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;

    const checkExpiry = async () => {
      const { data } = await supabase.from('lecture_sessions').select('is_active, expires_at').eq('session_id', activeSessionId).single();

      if (!data) {
        clearStaleSession('This session no longer exists.');
        return;
      }

      const isExpired = data.expires_at && new Date(data.expires_at).getTime() < Date.now();
      const isManuallyEnded = !data.is_active;

      if (isExpired || isManuallyEnded) {
        clearStaleSession(isManuallyEnded ? 'This session was ended.' : 'Time is up. The session expired.');
      }
    };

    const intervalId = setInterval(checkExpiry, SESSION_EXPIRY_POLL_MS);
    return () => clearInterval(intervalId);
  }, [activeSessionId, clearStaleSession]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) => { prewarmPosRef.current = { lat: position.coords.latitude, lng: position.coords.longitude, acc: position.coords.accuracy, ts: Date.now() }; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    prewarmWatchRef.current = id;
    return () => { if (prewarmWatchRef.current !== null) navigator.geolocation.clearWatch(prewarmWatchRef.current); };
  }, []);

  const loadHistory = useCallback(async () => {
    const course = courses.find(c => c.id === selectedCourseId);
    if (!course) return;
    try {
      const headers = await getHeaders();
      const response = await fetch(`/api/attendance-history?courseCode=${course.course_code}`, { headers });
      if (response.ok) setPastSessions(await response.json());
      else if (response.status === 401) router.push('/login');
    } catch { 
      console.error("Failed to load history"); 
    }
  }, [courses, selectedCourseId, router]);

  useEffect(() => {
    if (viewMode !== 'history') return;
    const id = setTimeout(() => { loadHistory(); }, 0);
    return () => clearTimeout(id);
  }, [viewMode, loadHistory]);  const startNewSession = () => {
    if (!selectedCourseId) { setSetupError("Please register a course first."); return; }
    setIsStarting(true);
    setSetupError("");
    setExpiredMessage('');
    if (!navigator.geolocation) { setSetupError("Location services not supported by your browser."); setIsStarting(false); return; }

    const executeSessionCreation = async (lat: number, lng: number) => {
      setSetupError("Creating session...");
      try {
        const headers = await getHeaders();
        const response = await fetch('/api/create-session', {
          method: 'POST', 
          headers,
          body: JSON.stringify({ courseId: selectedCourseId, courseCode: courses.find(c => c.id === selectedCourseId)?.course_code, latitude: lat, longitude: lng, duration: sessionDuration, checkinOpensAfter, startedBy: 'lecturer' })
        });
        if (response.ok) {
          const result = await response.json();
          localStorage.setItem(ACTIVE_SESSION_KEY, result.sessionId);
          try { localStorage.setItem(ANCHOR_CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now() })); } catch {}
          setActiveSessionId(result.sessionId);
          setViewMode('live');
        } else if (response.status === 401) {
          router.push('/login');
        } else { 
          setSetupError("Failed to create session on server."); 
        }
      } catch { 
        setSetupError("Network error. Please try again."); 
      } finally { 
        setIsStarting(false); 
      }
    };

    try {
      const cached = localStorage.getItem(ANCHOR_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { lat: number; lng: number; ts: number };
        if (Date.now() - parsed.ts < ANCHOR_CACHE_MAX_AGE_MS) {
          setSetupError("Using cached location..."); 
          executeSessionCreation(parsed.lat, parsed.lng); 
          return;
        }
      }
    } catch {}

    if (prewarmPosRef.current && Date.now() - prewarmPosRef.current.ts < 15000) {
      const snapshot = prewarmPosRef.current;
      setSetupError(`Using recent fix (±${Math.round(snapshot.acc)}m)...`);
      executeSessionCreation(snapshot.lat, snapshot.lng); 
      return;
    }

    setSetupError("Getting a stable GPS fix...");
    const readings: { lat: number; lng: number; acc: number }[] = [];
    let watchId = 0;
    let finished = false;

    const cleanup = () => { if (watchId) navigator.geolocation.clearWatch(watchId); };

    const finish = (lat: number, lng: number) => {
      if (finished) return;
      finished = true;
      cleanup();
      executeSessionCreation(lat, lng);
    };

    const fail = (msg: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      setSetupError(msg);
      setIsStarting(false);
    };

    const timeoutId = setTimeout(() => {
      if (finished) return;
      if (readings.length >= 3) {
        const lat = readings.reduce((s, r) => s + r.lat, 0) / readings.length;
        const lng = readings.reduce((s, r) => s + r.lng, 0) / readings.length;
        finish(lat, lng);
      } else {
        fail("Couldn't get a stable GPS fix. Move near a window or outdoors, then try again.");
      }
    }, 25000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (finished) return;
        const acc = position.coords.accuracy;
        if (acc > 50) {
          setSetupError(`GPS accuracy is ±${Math.round(acc)}m — too weak. Move near a window.`);
          return;
        }
        readings.push({ lat: position.coords.latitude, lng: position.coords.longitude, acc });

        if (readings.length >= 3) {
          const latSpread = Math.max(...readings.map(r => r.lat)) - Math.min(...readings.map(r => r.lat));
          const lngSpread = Math.max(...readings.map(r => r.lng)) - Math.min(...readings.map(r => r.lng));
          if (latSpread < 0.0003 && lngSpread < 0.0003) {
            clearTimeout(timeoutId);
            const lat = readings.reduce((s, r) => s + r.lat, 0) / readings.length;
            const lng = readings.reduce((s, r) => s + r.lng, 0) / readings.length;
            finish(lat, lng);
            return;
          }
          readings.shift();
          setSetupError(`GPS is still settling (±${Math.round(acc)}m)...`);
        } else {
          setSetupError(`Stabilizing GPS fix (${readings.length}/3, ±${Math.round(acc)}m)...`);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (error.code === 1) fail("Permission Denied: tap 'Allow' for location and try again.");
        else if (error.code === 2) fail("Signal lost. Turn your phone's GPS/Location off and back on, then retry.");
        else if (error.code === 3) fail("GPS timed out. Move near a window and try again.");
        else fail("Could not access GPS.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

  const updateGeofence = async () => {
    if (!activeSessionId) return;
    
    confirm.ask(
      'Update Geofence?',
      'Update the class anchor to your current location? Stand in the middle of the lecture hall first.',
      async () => {
        setIsUpdatingGeofence(true);
        try {
          if (!navigator.geolocation) throw new Error("No geolocation support");
          
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const acc = position.coords.accuracy;
              if (acc > 50) {
                confirm.ask('GPS Too Weak', `Your current accuracy is ±${Math.round(acc)}m. Move near a window or outdoors, then try again.`, () => {}, { isDangerous: false });
                setIsUpdatingGeofence(false);
                return;
              }

              const { error } = await supabase
                .from('lecture_sessions')
                .update({ anchor_latitude: position.coords.latitude, anchor_longitude: position.coords.longitude })
                .eq('session_id', activeSessionId);
                
              if (error) {
                confirm.ask('Error', 'Failed to update geofence.', () => {}, { isDangerous: false });
              } else {
                try { localStorage.setItem(ANCHOR_CACHE_KEY, JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude, ts: Date.now() })); } catch {}
                confirm.ask('Success', `Geofence updated (±${Math.round(acc)}m accuracy).`, () => {}, { isDangerous: false });
              }
              setIsUpdatingGeofence(false);
            },
            () => {
              confirm.ask('Error', 'Could not get your GPS location. Ensure location is on.', () => {}, { isDangerous: false });
              setIsUpdatingGeofence(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        } catch {
          confirm.ask('Error', 'Error updating location.', () => {}, { isDangerous: false });
          setIsUpdatingGeofence(false);
        }
      },
      { isDangerous: false, confirmLabel: 'Update GPS' }
    );
  };

  const endSession = () => {
    if (!activeSessionId) return;
    confirm.ask(
      'End this lecture?',
      'Students will no longer be able to check in. This cannot be undone.',
      async () => {
        try {
          const headers = await getHeaders();
          await fetch('/api/end-session', { method: 'POST', headers, body: JSON.stringify({ sessionId: activeSessionId }) });
        } catch (err) {
          console.error('Failed to notify server', err);
        }
        clearStaleSession('Session ended. Ready for the next one.');
      },
      { isDangerous: true, confirmLabel: 'End Lecture' }
    );
  };

  const fetchDashboardData = useCallback(async () => {
    if (!activeSessionId || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    try {
      const headers = await getHeaders();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/dashboard-data?sessionId=${activeSessionId}&timeZone=${encodeURIComponent(tz)}`, { headers });
      if (response.ok) { 
        setData(await response.json()); 
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch { 
      console.error("Failed to fetch data"); 
    } finally {
      isFetchingRef.current = false;
    }
  }, [activeSessionId, router]);

  useEffect(() => {
    if (!activeSessionId || viewMode !== 'live') return;
    const immediateId = setTimeout(() => { fetchDashboardData(); }, 0);
    
    const channel = supabase
      .channel(`attendance_${activeSessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: `session_id=eq.${activeSessionId}` }, () => { fetchDashboardData(); })
      .subscribe();

    const interval = setInterval(fetchDashboardData, 10000);

    return () => {
      clearTimeout(immediateId);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [activeSessionId, viewMode, fetchDashboardData]);  const handleManualOverride = async (targetMatric: string) => {
    const safeMatric = String(targetMatric || '').trim();
    if (!activeSessionId) return;
    if (!safeMatric) return;

    setIsOverriding(true);
    try {
      const headers = await getHeaders();
      const response = await fetch('/api/override-attendance', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId: activeSessionId, matricNumber: safeMatric }),
      });
      if (response.ok) {
        setManualMatric('');
        fetchDashboardData();
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsOverriding(false);
    }
  };

  const handleDeviceReset = (targetMatric: string) => {
    const safeMatric = String(targetMatric || '').trim();
    if (!safeMatric) return;

    confirm.ask(
      `Wipe device lock for ${safeMatric}?`,
      'They will need to re-register their biometrics on a new phone. Their attendance history will remain intact.',
      async () => {
        setIsResetting(true);
        try {
          const headers = await getHeaders();
          const response = await fetch('/api/reset-device', { method: 'POST', headers, body: JSON.stringify({ matricNumber: safeMatric }) });
          if (response.ok) setManualMatric('');
        } catch (err) {
          console.error(err);
        } finally {
          setIsResetting(false);
        }
      }
    );
  };

  const generateAndDownloadCSV = (logsToExport: Log[], courseName: string, dateStr: string, isArchive: boolean) => {
    if (!logsToExport || logsToExport.length === 0) return;
    const verifiedCount = logsToExport.filter(l => l.status === 'verified').length;

    const sanitize = (val: string | number) => {
      const str = String(val);
      if (/^[=+\-@]/.test(str)) return `'${str}`;
      return str;
    };

    const header = [
      [`OFFICIAL ATTENDANCE REPORT ${isArchive ? '(ARCHIVED)' : ''}`],
      ["Course Code", sanitize(courseName)], ["Date Generated", dateStr],
      ["Total Present", verifiedCount], ["Total Records Logged", logsToExport.length], [],
      ["Matric Number", "Status", "Timestamp", "Security Flag"]
    ];
    const rows = logsToExport.sort((a, b) => a.matricNumber.localeCompare(b.matricNumber))
      .map(log => {
        const flag = log.status === 'verified' ? 'Verified' 
          : log.status === 'pending_override' ? 'Raised Hand / Waiver Pending'
          : log.status === 'flagged' ? `Flagged: ${log.reason || 'Unknown'}`
          : log.status;
        return [ sanitize(log.matricNumber), sanitize(log.status.toUpperCase()), sanitize(log.time), sanitize(flag) ];
      });
      
    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${courseName.replace(/\s+/g, '_')}_Attendance_${dateStr.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportLiveCSV = () => { if (data) generateAndDownloadCSV(data.logs, data.course, new Date().toLocaleDateString(), false); };
  
  const downloadPastSession = async (sessionId: string, dateString: string, courseCode: string) => {
    setDownloadingId(sessionId);
    try {
      const headers = await getHeaders();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/dashboard-data?sessionId=${sessionId}&timeZone=${encodeURIComponent(tz)}`, { headers });
      if (!response.ok) throw new Error("Failed to fetch");
      const pastData = await response.json();
      generateAndDownloadCSV(pastData.logs, courseCode, dateString, true);
    } catch { 
      console.error("Download failed");
    }
    finally { setDownloadingId(null); }
  };

  const viewPastLedger = async (session: PastSession) => {
    setViewingPastSession(session);
    const headers = await getHeaders();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch(`/api/dashboard-data?sessionId=${session.session_id}&timeZone=${encodeURIComponent(tz)}`, { headers });
    if (response.ok) {
      const result = await response.json();
      setPastSessionLogs(result.logs);
    }
  };

  const copySessionInfo = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?sessionId=${activeSessionId}`;
    const courseName = data?.course || 'Active Class';
    const clipboardText = `📌 *CampusCheck Attendance Link*\n\n📚 Class: ${courseName}\n⏱ Opens: ${checkinOpensAfter === 0 ? 'Immediately' : `In ${checkinOpensAfter} minutes`}\n\n🔗 ${link}\n\n_Open this link on your phone to check in. You must be inside the lecture hall._`;
    navigator.clipboard.writeText(clipboardText);
    confirm.ask('Link Copied', 'Attendance link copied! Share it with your students.', () => {}, { isDangerous: false });
  };

  const filteredHistory = pastSessions.filter(s => 
    s.course_code.toLowerCase().includes(historySearch.toLowerCase()) || 
    new Date(s.created_at).toLocaleString().toLowerCase().includes(historySearch.toLowerCase())
  );

  if (!activeSessionId || viewMode === 'history') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-8 font-sans">
        <div className="max-w-4xl mx-auto">
          {expiredMessage && (
            <div className="mb-4 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-bold text-amber-900 text-sm">{expiredMessage}</p>
                <p className="text-xs text-amber-700 font-medium mt-1">Start a new session below, or review past records.</p>
              </div>
              <button onClick={() => setExpiredMessage('')} className="text-amber-600 hover:text-amber-800 text-xs font-bold">Dismiss</button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                {viewMode === 'history' ? <Archive className="text-[#2563EB]" /> : <ShieldCheck className="text-[#2563EB]" />}
                {viewMode === 'history' ? 'Vault Archive' : 'Start Lecture'}
              </h2>
              <p className="text-gray-500 font-medium mt-1">
                {viewMode === 'history' ? 'Review past session ledgers and download reports.' : `Welcome, ${profile?.full_name || 'Lecturer'}`}
              </p>
            </div>
            <div className="flex bg-gray-50 p-1 rounded-xl w-full md:w-auto items-center">
              <button onClick={() => { setViewMode('live'); setActiveSessionId(null); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'live' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Start Class</button>
              <button onClick={() => { setViewMode('history'); setActiveSessionId('vault'); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Past Records</button>
            </div>
          </div>

          {viewMode === 'live' ? (
            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 text-center animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-[#2563EB] text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                <User size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Ready to start?</h2>
              
              {courses.length === 0 ? (
                <div className="text-center py-8 space-y-4 mt-6">
                  <div className="bg-blue-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <BookOpen size={36} className="text-[#2563EB]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">No courses yet</h3>
                    <p className="text-sm text-gray-500 font-medium mt-1">You need to create a course before starting a lecture.</p>
                  </div>
                  <Link href="/dashboard/courses" className="inline-block bg-[#2563EB] text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-blue-700 transition-all">
                    Go to Course Management
                  </Link>
                </div>
              ) : (
                <div className="relative mb-4 mt-6">
                  <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-xl py-4 pl-4 pr-10 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all appearance-none cursor-pointer">
                    {courses.map(course => <option key={course.id} value={course.id}>{course.course_code}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500"><ChevronDown size={24} strokeWidth={2.5} /></div>
                </div>
              )}

              <div className="space-y-3 mt-4">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] transition-all overflow-hidden">
                  <div className="pl-4 pr-3 flex items-center justify-center text-gray-400"><Timer size={20} /></div>
                  <select value={sessionDuration} onChange={(e) => setSessionDuration(Number(e.target.value))} className="w-full bg-transparent text-gray-900 font-bold py-4 pr-4 outline-none appearance-none cursor-pointer">
                    <option value={15}>Duration: 15 Minutes (Quiz)</option>
                    <option value={30}>Duration: 30 Minutes</option>
                    <option value={60}>Duration: 1 Hour (Standard)</option>
                    <option value={90}>Duration: 1.5 Hours</option>
                    <option value={120}>Duration: 2 Hours</option>
                  </select>
                </div>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] transition-all overflow-hidden">
                  <div className="pl-4 pr-3 flex items-center justify-center text-gray-400"><Lock size={20} /></div>
                  <select value={checkinOpensAfter} onChange={(e) => setCheckinOpensAfter(Number(e.target.value))} className="w-full bg-transparent text-gray-900 font-bold py-4 pr-4 outline-none appearance-none cursor-pointer">
                    <option value={0}>Opens: Immediately</option>
                    <option value={5}>Opens: After 5 minutes</option>
                    <option value={10}>Opens: After 10 minutes</option>
                    <option value={15}>Opens: After 15 minutes</option>
                    <option value={30}>Opens: After 30 minutes</option>
                  </select>
                </div>
                <button onClick={startNewSession} disabled={isStarting || courses.length === 0} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 mt-2">
                  {isStarting ? <RefreshCw className="animate-spin" size={20} /> : <MapPin size={20} />} {isStarting ? "Anchoring Geofence..." : "Establish Geofence"}
                </button>
                {setupError && <p className="text-sm text-red-500 font-bold mt-4">{setupError}</p>}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              {!viewingPastSession ? (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-gray-400" /></div>
                    <input type="text" placeholder="Search by date or course..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full bg-white border border-gray-200 p-3 pl-10 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] transition-all" />
                  </div>

                  {filteredHistory.map(session => (
                    <div key={session.session_id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-300 transition-colors">
                      <div>
                        <h3 className="font-black text-gray-900 text-lg">{session.course_code}</h3>
                        <p className="text-sm text-gray-500 font-medium">{new Date(session.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                        <div className="flex gap-6 w-full sm:w-auto justify-around">
                          <div className="text-center">
                            <p className="text-xl font-black text-green-600">{session.verified_count}</p>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Verified</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-black text-red-500">{session.flagged_count}</p>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Flagged</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={() => viewPastLedger(session)} className="flex-1 sm:flex-none justify-center bg-blue-50 text-[#2563EB] px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center gap-2">
                            <FileText size={16} /> View
                          </button>
                          <button onClick={() => downloadPastSession(session.session_id, new Date(session.created_at).toLocaleDateString(), session.course_code)} disabled={downloadingId === session.session_id} className="flex-1 sm:flex-none justify-center bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-2">
                            {downloadingId === session.session_id ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />} CSV
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredHistory.length === 0 && (
                    <p className="text-center text-gray-500 font-bold py-10 bg-white rounded-2xl border border-gray-200">
                      {pastSessions.length === 0 ? "No past records found for this course." : "No records match your search."}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-gray-900 text-lg">Ledger: {viewingPastSession.course_code}</h3>
                      <p className="text-xs text-gray-500 font-bold">{new Date(viewingPastSession.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setViewingPastSession(null)} className="text-sm font-bold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">Close</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                          <th className="px-6 py-4 font-bold">Matric Number</th>
                          <th className="px-6 py-4 font-bold">Time</th>
                          <th className="px-6 py-4 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pastSessionLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4 font-bold text-gray-900">
                              {log.matricNumber}
                              {log.nickname && <span className="block text-[10px] text-gray-400">({log.nickname})</span>}
                            </td>
                            <td className="px-6 py-4 text-gray-500 flex items-center gap-2 text-sm font-medium"><Clock size={14} /> {log.time}</td>
                            <td className="px-6 py-4">
                              {log.status === 'verified' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200"><CheckCircle size={12} /> Verified</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"><AlertTriangle size={12} /> Flagged</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <ConfirmModal config={confirm.config} onClose={confirm.close} />
      </div>
    );
  }  const verifiedLogs = data?.logs.filter(l => l.status === 'verified') || [];
  const flaggedLogs = data?.logs.filter(l => l.status !== 'verified') || [];

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={20} className="text-[#2563EB]" />
                <span className="text-sm font-bold text-[#2563EB] uppercase tracking-wider">CampusCheck • {profile?.full_name || 'Faculty'}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Live Attendance</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-gray-500 font-bold text-lg">{data?.course || 'Loading...'}</span>
                
                {data?.startedBy === 'Class Rep' && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 ml-2">
                    <ShieldAlert size={12} /> Started by Rep
                  </span>
                )}
                
                <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 ml-2">
                  <Wifi size={12} /> Live Sync
                </span>

                {data && (
                  <span className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 ml-2" title="Students are measured against this anchor">
                    <MapPin size={12} /> Anchor: {data.course ? 'set' : 'pending'}
                  </span>
                )}

                {data?.hiddenDisqualifiedCount !== undefined && data.hiddenDisqualifiedCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-200 ml-2">
                    <ShieldAlert size={12} /> {data.hiddenDisqualifiedCount} attempts disqualified
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 gap-6 w-full md:w-auto mt-2 md:mt-0">
              <div><p className="text-2xl font-extrabold text-gray-900">{data?.logs.length || 0}</p><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Check-ins</p></div>
              <button onClick={exportLiveCSV} disabled={!data || data.logs.length === 0} className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"><Download size={16} /> Export</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <button onClick={copySessionInfo} className="flex justify-center items-center gap-2 text-sm font-bold bg-white text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"><Copy size={16} /> Share Link</button>
            <button onClick={updateGeofence} disabled={isUpdatingGeofence} className="flex justify-center items-center gap-2 text-sm font-bold bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl border border-blue-200 shadow-sm hover:bg-blue-100 active:scale-[0.98] transition-all disabled:opacity-50">
              {isUpdatingGeofence ? <RefreshCw size={16} className="animate-spin" /> : <Navigation size={16} />} Update GPS
            </button>
            <button onClick={endSession} className="flex justify-center items-center gap-2 text-sm font-bold bg-red-50 text-red-600 px-4 py-2.5 rounded-xl border border-red-200 shadow-sm hover:bg-red-100 active:scale-[0.98] transition-all md:col-span-1 col-span-2"><XCircle size={16} /> End Lecture</button>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><UserPlus size={16} className="text-[#2563EB]"/> Students & Courses Management</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Matric Number" value={manualMatric} onChange={(e) => setManualMatric(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && handleManualOverride(manualMatric)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all placeholder:text-gray-400 placeholder:font-medium uppercase" />
            <div className="flex gap-2">
              <button onClick={() => handleManualOverride(manualMatric)} disabled={!manualMatric.trim() || isOverriding} className="whitespace-nowrap bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-md">
                {isOverriding ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />} {isOverriding ? "Forcing..." : "Force Check-In"}
              </button>
              <button onClick={() => handleDeviceReset(manualMatric)} disabled={!manualMatric.trim() || isResetting} className="whitespace-nowrap bg-red-50 text-red-600 px-4 py-3 rounded-xl font-bold text-sm border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-all flex justify-center items-center gap-2">
                {isResetting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />} Wipe
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => setLedgerTab('verified')} 
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${ledgerTab === 'verified' ? 'bg-green-50/50 text-green-700 border-b-2 border-green-500' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <CheckCircle size={16} /> Verified ({verifiedLogs.length})
            </button>
            <button 
              onClick={() => setLedgerTab('flagged')} 
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${ledgerTab === 'flagged' ? 'bg-red-50/50 text-red-700 border-b-2 border-red-500' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <AlertTriangle size={16} /> Review Required ({flaggedLogs.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            {ledgerTab === 'verified' ? (
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-4 md:px-6 py-4 font-bold">Matric Number</th>
                    <th className="px-4 md:px-6 py-4 font-bold">Time</th>
                    <th className="px-4 md:px-6 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {verifiedLogs.length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400 font-bold">No verified check-ins yet.</td></tr>
                  ) : (
                    verifiedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-gray-900">
                          {log.matricNumber}
                          {log.nickname && <span className="block text-[10px] text-gray-400 font-semibold">({log.nickname})</span>}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-gray-500 flex items-center gap-2 text-sm font-medium"><Clock size={14} /> {log.time}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {log.isBiometric ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200"><CheckCircle size={12} strokeWidth={2.5} /> Biometric</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"><MapPin size={12} strokeWidth={2.5} /> GPS Only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="divide-y divide-gray-100">
                {flaggedLogs.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400 font-bold">No students require review.</div>
                ) : (
                  flaggedLogs.map((log) => (
                    <div key={log.id} className="p-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-red-50/30 transition-colors">
                      <div>
                        <p className="font-bold text-gray-900 text-lg">
                          {log.matricNumber}
                          {log.nickname && <span className="text-sm text-gray-500 font-medium ml-2">({log.nickname})</span>}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] uppercase font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                            {log.status === 'pending_override' ? <Hand size={10} /> : <AlertTriangle size={10} />}
                            {log.status === 'pending_override' ? 'Raised Hand' : 'Flagged'}
                          </span>
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <Clock size={12} /> {log.time}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 font-medium mt-2">
                          <strong>Reason:</strong> {log.reason || 'Biometric skipped or location anomaly'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleManualOverride(log.matricNumber)}
                        className="whitespace-nowrap bg-white border border-red-200 text-red-700 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <ShieldCheck size={16} /> Approve
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal config={confirm.config} onClose={confirm.close} />
    </div>
  );
}