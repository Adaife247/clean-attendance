'use client';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Search, ShieldCheck, User, CheckCircle, AlertTriangle, 
  Clock, ArrowLeft, Target, TrendingUp, Zap, Award
} from 'lucide-react';
import Link from 'next/link';

interface CourseRecord {
  course_code: string;
  total_classes: number;
  attended_classes: number;
  percentage: number;
  skips_left: number;
  streak: number;
  streak_tier: 'JJC' | 'Consistent' | 'Odogwu' | 'None';
}

interface SessionRow {
  session_id: string;
  course_code: string;
  created_at: string;
}

interface LogRow {
  session_id: string;
  status: string;
}

export default function StudentPortal() {
  const [matricNumber, setMatricNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [records, setRecords] = useState<CourseRecord[] | null>(null);
  const [error, setError] = useState('');

  const fetchRecords = async () => {
    if (matricNumber.length < 5) return;
    setIsSearching(true);
    setError('');
    setRecords(null);

    const cleanMatric = matricNumber.toUpperCase().trim();

    try {
      // 1. Find every course this student is enrolled in
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

      // 2. Get the course codes for those course IDs
      const { data: courseRows, error: courseError } = await supabase
        .from('courses')
        .select('id, course_code')
        .in('id', courseIds);

      if (courseError) throw courseError;
      if (!courseRows || courseRows.length === 0) {
        setError("No course details found.");
        return;
      }

      const courseCodeMap = new Map<string, string>();
      courseRows.forEach(c => courseCodeMap.set(c.id, c.course_code));
      const courseCodes = courseRows.map(c => c.course_code);

      // 3. Get ALL sessions held for each of these courses (the denominator)
      const { data: sessionRows, error: sessionError } = await supabase
        .from('lecture_sessions')
        .select('session_id, course_code, created_at')
        .in('course_code', courseCodes)
        .order('created_at', { ascending: false });

      if (sessionError) throw sessionError;

      // 4. Get this student's logs for those sessions
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

      // 5. Build a lookup: session_id → status
      const logStatusMap = new Map<string, string>();
      studentLogs.forEach(l => logStatusMap.set(l.session_id, l.status));

      // 6. Compute per-course stats
      const courseStats = new Map<string, { total: number; attended: number; sessions: SessionRow[] }>();

      (sessionRows || []).forEach(session => {
        const course = session.course_code;
        const stats = courseStats.get(course) || { total: 0, attended: 0, sessions: [] };
        stats.total += 1;
        stats.sessions.push(session);

        const status = logStatusMap.get(session.session_id);
        if (status === 'verified') stats.attended += 1;

        courseStats.set(course, stats);
      });

      // 7. Compute streaks per course (most recent consecutive verified)
      const finalRecords: CourseRecord[] = [];

      courseStats.forEach((stats, course) => {
        const total = stats.total;
        const attended = stats.attended;
        const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

        // Skips left = how many more absences before dropping below 70%
        // Formula: we need attended / total >= 0.70.
        // If current percentage already < 70, skips_left = 0.
        // Otherwise: max absences allowed = floor(total * 0.30). Current absences = total - attended.
        const maxAbsences = Math.floor(total * 0.30);
        const currentAbsences = total - attended;
        const skipsLeft = Math.max(0, maxAbsences - currentAbsences);

        // Streak: sessions are ordered newest first, so walk through until non-verified
        let streak = 0;
        for (const session of stats.sessions) {
          const status = logStatusMap.get(session.session_id);
          if (status === 'verified') streak += 1;
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
      const msg = err instanceof Error ? err.message : "Failed to fetch records.";
      setError(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const getShieldColor = (pct: number) => {
    if (pct >= 70) return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
    if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
  };

  const getTierBadge = (tier: CourseRecord['streak_tier'], streak: number) => {
    if (tier === 'None') return null;
    const styles: Record<string, string> = {
      JJC: 'bg-blue-100 text-blue-700 border-blue-200',
      Consistent: 'bg-purple-100 text-purple-700 border-purple-200',
      Odogwu: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    const icons: Record<string, React.ReactNode> = {
      JJC: <Zap size={12} />,
      Consistent: <TrendingUp size={12} />,
      Odogwu: <Award size={12} />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[tier]}`}>
        {icons[tier]} {tier} • {streak}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">

        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-2 font-medium">Student Records Portal</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-6">
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Matric Number (e.g. CSC/2021/001)"
              value={matricNumber}
              onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium"
            />
          </div>

          <button
            onClick={fetchRecords}
            disabled={matricNumber.length < 5 || isSearching}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {isSearching ? <Clock className="animate-spin" size={20} /> : <Search size={20} />}
            {isSearching ? "Loading Your Shield..." : "Check Records"}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 text-center">
              <p className="text-red-700 font-bold text-sm">{error}</p>
            </div>
          )}

          {records && records.length > 0 && (
            <div className="mt-8 space-y-5 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-900">Your Clearance Shield</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">NUC 70% Threshold</span>
              </div>

              {records.map((record) => {
                const colors = getShieldColor(record.percentage);
                const isCleared = record.percentage >= 70;

                return (
                  <div
                    key={record.course_code}
                    className={`${colors.bg} p-4 rounded-2xl border ${colors.border} transition-colors`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg leading-tight">{record.course_code}</p>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          Attended {record.attended_classes} of {record.total_classes} classes
                        </p>
                        {getTierBadge(record.streak_tier, record.streak) && (
                          <div className="mt-2">{getTierBadge(record.streak_tier, record.streak)}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-2xl ${colors.text}`}>{record.percentage}%</p>
                        {isCleared ? (
                          <span className="text-[10px] uppercase font-bold text-green-600 flex items-center justify-end gap-1 mt-0.5">
                            <CheckCircle size={10} /> Cleared
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-red-600 flex items-center justify-end gap-1 mt-0.5">
                            <AlertTriangle size={10} /> At Risk
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clearance Shield progress bar */}
                    <div className="relative w-full h-3 bg-white rounded-full overflow-hidden border border-gray-200">
                      <div
                        className={`h-full ${colors.bar} transition-all duration-700 ease-out`}
                        style={{ width: `${Math.min(record.percentage, 100)}%` }}
                      />
                      {/* 70% threshold marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-gray-900/40"
                        style={{ left: '70%' }}
                        title="NUC 70% Threshold"
                      />
                    </div>

                    {/* Safe Skips indicator */}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-gray-600 font-bold">
                        <Target size={14} className="text-gray-400" />
                        {record.skips_left > 0 ? (
                          <span>
                            Safe Skips: <span className="text-gray-900 font-black">{record.skips_left}</span>
                          </span>
                        ) : isCleared ? (
                          <span className="text-yellow-700">No more skips — on the edge</span>
                        ) : (
                          <span className="text-red-700">Below threshold — attend everything</span>
                        )}
                      </div>
                      {isCleared && record.skips_left > 0 && (
                        <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
                          Exam Pass Unlocked
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <p className="text-[11px] text-gray-400 font-medium text-center pt-2">
                The 70% threshold is set by the Nigerian Universities Commission (NUC).
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center animate-in fade-in">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
        </div>

      </div>
    </div>
  );
}