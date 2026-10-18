'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  ShieldCheck, Users, BookOpen, Star, TrendingUp, AlertTriangle,
  ArrowLeft, Loader2, BarChart3, CheckCircle
} from 'lucide-react';
import Link from 'next/link';

interface LecturerStat {
  id: string;
  full_name: string;
  department: string;
  course_count: number;
  session_count: number;
  avg_rating: number;
  total_ratings: number;
}

interface ComplianceData {
  total: number;
  cleared: number;
  atRisk: number;
}

export default function HODPortal() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LecturerStat[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData>({ total: 0, cleared: 0, atRisk: 0 });

  const fetchDepartmentData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('lecturers')
      .select('department')
      .eq('id', session.user.id)
      .single();

    // --- SECLUSION CHECK ---
    // If the user has no department, they are not authorized to view this page.
    if (!profile?.department) {
      router.push('/dashboard');
      return;
    }

    const res = await fetch(`/api/hod-data?department=${encodeURIComponent(profile.department)}`);
    if (res.ok) {
      const data = await res.json();
      setStats(data.lecturers);
      setCompliance(data.compliance);
    } else {
      router.push('/dashboard');
    }
    
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const id = setTimeout(() => { fetchDepartmentData(); }, 0);
    return () => clearTimeout(id);
  }, [fetchDepartmentData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-[#2563EB] mx-auto mb-4" size={32} />
          <p className="text-gray-500 font-bold animate-pulse">Authenticating HOD Clearance...</p>
        </div>
      </div>
    );
  }

  const complianceRate = compliance.total > 0 
    ? Math.round((compliance.cleared / compliance.total) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-[#2563EB] p-2 rounded-lg">
                <ShieldCheck className="text-white" size={24} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">HOD Command Center</h1>
            </div>
            <p className="text-gray-500 font-medium">Department-wide analytics and NUC compliance.</p>
          </div>
          <Link href="/dashboard" className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">
            <ArrowLeft size={16} /> Back to Lecturer View
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-blue-50 text-[#2563EB] p-4 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Lecturers</p>
              <p className="text-3xl font-black text-gray-900">{stats.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Dept. Avg Rating</p>
              <p className="text-3xl font-black text-gray-900">
                {(stats.reduce((acc, s) => acc + s.avg_rating, 0) / (stats.length || 1)).toFixed(1)} <span className="text-lg text-gray-400">/ 5</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-purple-50 text-purple-600 p-4 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Sessions</p>
              <p className="text-3xl font-black text-gray-900">{stats.reduce((acc, s) => acc + s.session_count, 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <CheckCircle className="text-[#2563EB]" size={20} /> NUC Exam Compliance
              </h3>
              <p className="text-sm text-gray-500 font-medium mt-1">Percentage of enrolled students with ≥70% attendance.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-gray-900">{complianceRate}%</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dept. Cleared</p>
            </div>
          </div>
          
          <div className="relative w-full h-6 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-inner">
            <div 
              className="absolute top-0 left-0 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000"
              style={{ width: `${complianceRate}%` }}
            />
            <div className="absolute top-0 bottom-0 w-1 bg-gray-900/30" style={{ left: '70%' }} />
          </div>
          
          <div className="flex justify-between items-center mt-3 text-sm font-bold">
            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> {compliance.cleared} Cleared</span>
            <span className="text-gray-500">{compliance.total} Total Students</span>
            <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={14}/> {compliance.atRisk} At Risk</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-[#2563EB]" /> Lecturer Performance
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4 font-bold">Lecturer Name</th>
                  <th className="px-6 py-4 font-bold text-center">Courses</th>
                  <th className="px-6 py-4 font-bold text-center">Sessions Held</th>
                  <th className="px-6 py-4 font-bold text-right">Student Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map((lec) => (
                  <tr key={lec.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{lec.full_name}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-600">{lec.course_count}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-600">{lec.session_count}</td>
                    <td className="px-6 py-4 text-right">
                      {lec.total_ratings > 0 ? (
                        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                          <span className="font-black">{lec.avg_rating}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70">({lec.total_ratings} votes)</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-3 py-1.5 rounded-lg">No ratings yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}