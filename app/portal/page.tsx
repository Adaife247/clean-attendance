'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ShieldCheck, User, CheckCircle, AlertTriangle, 
  Clock, ArrowLeft, Target, TrendingUp, Zap, Flame, Radio, Lock
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

interface LogRow {
  session_id: string;
  status: string;
}

interface SessionRow {
  session_id: string;
  course_code: string;
  created_at: string;
  is_active: boolean;
}

export default function StudentPortal() {
  const [matricNumber, setMatricNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [records, setRecords] = useState<CourseRecord[] | null>(null);
  const [error, setError] = useState('');
  const [activeLiveClass, setActiveLiveClass] = useState<string | null>(null);

  // Load saved matric on mount
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

    const cleanMatric = matricNumber.toUpperCase().trim();
    localStorage.setItem('campuscheck_student_matric', cleanMatric);

    try {
      // 1. REQUIRE WEBAUTHN AUTHENTICATION FIRST
      const genRes = await fetch('/api/webauthn/auth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric })
      });

      if (genRes.status === 404) {
        throw new Error("You haven't linked your biometrics yet. You must check into a lecture first.");
      }

      const options = await genRes.json();
      if (options.error) throw new Error(options.error);

      const asseResp = await startAuthentication(options);

      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: cleanMatric, authResponse: asseResp })
      });

      const verifyResult = await verifyRes.json();
      if (!verifyResult.verified) {
        throw new Error("Biometric verification failed. Access denied.");
      }

      // 2. FETCH RECORDS (Only if biometrics passed)
      const { data: enrollmentRows, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('matric_number', cleanMatric);

      if (enrollError) throw enrollError;

      if (!enrollmentRows || enrollmentRows.length === 0) {
        setError("You are not enrolled in any course yet. Please contact your lecturer.");
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
        .select('session_id, course_code, created_at, is_active')
        .in('course_code', courseCodes)
        .order('created_at', { ascending: false });

      if (sessionError) throw sessionError;

      const liveSession = sessionRows?.find(s => s.is_active === true);
      if (liveSession) setActiveLiveClass(liveSession.course_code);

      const sessionIds = (sessionRows || []).map(s => s.session_id);
      let studentLogs: LogRow[] = [];

      if (sessionIds.length > 0) {
        const { data: logRows, error: logError } = await supabase
          .from('attendance_logs')
          .select('session_id, status')
          .eq('matric_number', cleanMatric)
          .in('session_id', sessionIds)
          .eq('status', 'verified'); // ONLY COUNT VERIFIED AS ATTENDED

        if (logError) throw logError;
        studentLogs = logRows || [];
      }

      const logStatusMap = new Map<string, string>();
      studentLogs.forEach(l => logStatusMap.set(l.session_id, l.status));

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
          course_code: course,
          total_classes: total,
          attended_classes: attended,
          percentage,
          skips_left: skipsLeft,
          streak,
          streak_tier: tier,
        });
      });

      finalRecords.sort((a, b) => a.course_code.localeCompare(b.course_code));
      setRecords(finalRecords);

    } catch (err) {
      // Fixed: Properly handling unknown error type
      const msg = err instanceof Error ? err.message : "Verification failed.";
      setRecords(null);
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const getShieldColor = (pct: number) => {
    if (pct >= 70) return { bar: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' };
    if (pct >= 50) return { bar: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]', text: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-200' };
    return { bar: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-red-700', bg: 'bg-red-50/50', border: 'border-red-200' };
  };

  const getTierBadge = (tier: CourseRecord['streak_tier'], streak: number) => {
    if (tier === 'None') return null;
    
    if (tier === 'Odogwu') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-linear-to-r from-amber-100 to-orange-100 text-orange-800 border border-orange-200 shadow-sm">
          <Flame size={12} className="text-orange-500" /> Odogwu • {streak}
        </span>
      );
    }
    if (tier === 'Consistent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">
          <TrendingUp size={12} /> Consistent • {streak}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
        <Zap size={12} /> JJC • {streak}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 pt-8">
        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Survival Companion</h1>
          <p className="text-gray-500 mt-2 font-medium">Track your NUC clearance status</p>
        </div>

        {activeLiveClass && (
          <div className="mb-6 bg-green-500 text-white p-4 rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-between animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full animate-pulse">
                <Radio size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-green-100">Lecture Live Now</p>
                <p className="font-extrabold text-lg">{activeLiveClass}</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white text-green-700 px-3 py-1.5 rounded-lg shadow-sm">
              Check Link
            </span>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-4xl shadow-xl shadow-gray-200/50 border border-white p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-6">
          
          {!records && (
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Matric Number (e.g. CSC/2021/001)"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyAndFetch()}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium"
              />
            </div>
          )}

          {!records ? (
            <button
              onClick={handleVerifyAndFetch}
              disabled={matricNumber.length < 5 || isVerifying}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-gray-900/20 hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {isVerifying ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
              {isVerifying ? "Verifying Biometrics..." : "Unlock My Records"}
            </button>
          ) : (
            <button
              onClick={() => { setRecords(null); }}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold text-sm py-3 rounded-xl hover:bg-gray-200 transition-all"
            >
              <Lock size={16} /> Lock & Search Another
            </button>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 text-center animate-in fade-in">
              <p className="text-red-700 font-bold text-sm">{error}</p>
            </div>
          )}

          {records && records.length > 0 && (
            <div className="mt-8 space-y-5 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-extrabold text-gray-900 text-lg">Clearance Shield</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-md">NUC 70%</span>
              </div>

              {records.map((record) => {
                const colors = getShieldColor(record.percentage);
                const isCleared = record.percentage >= 70;

                return (
                  <div key={record.course_code} className={`relative overflow-hidden ${colors.bg} p-5 rounded-2xl border ${colors.border} transition-colors`}>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="font-black text-gray-900 text-xl leading-tight tracking-tight">{record.course_code}</p>
                        <p className="text-xs text-gray-600 font-semibold mt-1 bg-white/50 inline-block px-2 py-0.5 rounded-md">
                          {record.attended_classes} / {record.total_classes} Classes
                        </p>
                        <div className="mt-2.5">
                          {getTierBadge(record.streak_tier, record.streak)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-3xl tracking-tighter ${colors.text}`}>{record.percentage}<span className="text-lg">%</span></p>
                        {isCleared ? (
                          <span className="text-[10px] uppercase font-black text-emerald-600 flex items-center justify-end gap-1 mt-1">
                            <CheckCircle size={12} strokeWidth={3} /> Cleared
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-black text-red-600 flex items-center justify-end gap-1 mt-1">
                            <AlertTriangle size={12} strokeWidth={3} /> At Risk
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="relative w-full h-4 bg-gray-200/50 rounded-full overflow-hidden border border-gray-300/50 shadow-inner">
                      <div className={`h-full ${colors.bar} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(record.percentage, 100)}%` }} />
                      <div className="absolute top-0 bottom-0 w-1 bg-gray-900/30" style={{ left: '70%' }} />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs relative z-10">
                      <div className="flex items-center gap-1.5 text-gray-700 font-bold bg-white/60 px-2.5 py-1.5 rounded-lg">
                        <Target size={14} className="text-gray-500" />
                        {record.skips_left > 0 ? (
                          <span>Safe Skips: <strong className="text-gray-900">{record.skips_left}</strong></span>
                        ) : isCleared ? (
                          <span className="text-amber-700">No more skips</span>
                        ) : (
                          <span className="text-red-700">Attend everything</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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