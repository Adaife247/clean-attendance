'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, ShieldCheck, User, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Record { course_code: string; total_classes: number; attended_classes: number; percentage: number; }

export default function StudentPortal() {
  const [matricNumber, setMatricNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [records, setRecords] = useState<Record[] | null>(null);
  const [error, setError] = useState('');

  const fetchRecords = async () => {
    if (matricNumber.length < 5) return;
    setIsSearching(true);
    setError('');
    
    try {
      const cleanMatric = matricNumber.toUpperCase().trim();
      const { data: studentLogs, error: logError } = await supabase.from('attendance_logs').select('session_id, status').eq('matric_number', cleanMatric);

      if (logError || !studentLogs || studentLogs.length === 0) {
        setError("No records found for this matric number.");
        setRecords([]);
        return;
      }

      const sessionIds = studentLogs.map(log => log.session_id);
      const { data: sessions } = await supabase.from('lecture_sessions').select('session_id, course_code').in('session_id', sessionIds);

      if (!sessions) return;

      const courseStats = new Map<string, { total: number; attended: number }>();
      
      studentLogs.forEach(log => {
        const session = sessions.find(s => s.session_id === log.session_id);
        if (session && session.course_code) {
          const course = session.course_code;
          const currentStats = courseStats.get(course) || { total: 0, attended: 0 };
          courseStats.set(course, { total: currentStats.total + 1, attended: currentStats.attended + (log.status === 'verified' ? 1 : 0) });
        }
      });

      const finalRecords = Array.from(courseStats.entries()).map(([course, stats]) => ({
        course_code: course, total_classes: stats.total, attended_classes: stats.attended, percentage: Math.round((stats.attended / stats.total) * 100)
      }));

      setRecords(finalRecords);
    } catch (err) { setError("Failed to fetch records. Please try again."); } 
    finally { setIsSearching(false); }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900"></div>
        <div className="text-center mb-8 mt-2">
          <ShieldCheck size={28} className="text-gray-900 mx-auto mb-2" strokeWidth={2.5} />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Portal</h1>
          <p className="text-gray-500 mt-2 text-sm font-medium">Check your exam eligibility status.</p>
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
          <input type="text" placeholder="Matric Number (e.g. CSC/2021/001)" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && fetchRecords()} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-gray-900 transition-all uppercase placeholder:text-sm placeholder:font-medium" />
        </div>
        
        <button onClick={fetchRecords} disabled={matricNumber.length < 5 || isSearching} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
          {isSearching ? <Clock className="animate-spin" size={20} /> : <Search size={20} />} {isSearching ? "Searching Ledger..." : "Check Records"}
        </button>

        {error && <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 text-center"><p className="text-red-700 font-bold text-sm">{error}</p></div>}

        {records && records.length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Your Attendance</h3>
            {records.map((record) => (
              <div key={record.course_code} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-gray-900">{record.course_code}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">Attended {record.attended_classes} of {record.total_classes} classes</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-xl ${record.percentage >= 70 ? 'text-green-600' : 'text-red-600'}`}>{record.percentage}%</p>
                  {record.percentage >= 70 ? (
                    <span className="text-[10px] uppercase font-bold text-green-600 flex items-center gap-1"><CheckCircle size={10}/> Eligible</span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold text-red-600 flex items-center gap-1"><AlertTriangle size={10}/> At Risk</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}