'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, ShieldCheck, User, CheckCircle, AlertTriangle, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">
        
        {/* PREMIUM BRANDING HEADER */}
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
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
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
            {isSearching ? "Searching Ledger..." : "Check Records"}
          </button>

          {error && <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100 text-center"><p className="text-red-700 font-bold text-sm">{error}</p></div>}

          {records && records.length > 0 && (
            <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Your Attendance</h3>
              {records.map((record) => (
                <div key={record.course_code} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center hover:border-blue-200 transition-colors">
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

        {/* Back to Hub Navigation */}
        <div className="mt-6 text-center animate-in fade-in">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
        </div>

      </div>
    </div>
  );
}