'use client';
import { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, UserPlus, Download, MapPin, Copy, XCircle, User, ChevronDown } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// This directly initializes Supabase so TypeScript never loses it
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Log { id: string; matricNumber: string; status: string; time: string; }
interface DashboardData { course: string; isActive: boolean; logs: Log[]; }
interface LecturerProfile { full_name: string; department: string; }
interface Course { id: string; course_code: string; }

export default function LecturerDashboard() {
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [manualMatric, setManualMatric] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  useEffect(() => {
    const securePageAndFetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      const { data: profileData } = await supabase.from('lecturers').select('*').eq('id', session.user.id).single();
      if (profileData) setProfile(profileData);

      const { data: courseData } = await supabase.from('courses').select('id, course_code').eq('lecturer_id', session.user.id).order('created_at', { ascending: false });
      if (courseData) {
        setCourses(courseData);
        if (courseData.length > 0) setSelectedCourseId(courseData[0].id);
      }
    };
    securePageAndFetchProfile();
  }, []);

  useEffect(() => {
    const savedSession = localStorage.getItem('active_attendance_session');
    if (savedSession) setActiveSessionId(savedSession);
  }, []);

  const startNewSession = () => {
    if (!selectedCourseId) { setSetupError("Please register a course first."); return; }
    setIsStarting(true);
    setSetupError("Acquiring dynamic podium coordinates...");
    
    if (!navigator.geolocation) { setSetupError("Location services not supported."); setIsStarting(false); return; }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setSetupError("Creating database session...");
        try {
          const response = await fetch('/api/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: selectedCourseId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          });
          if (response.ok) {
            const result = await response.json();
            localStorage.setItem('active_attendance_session', result.sessionId);
            setActiveSessionId(result.sessionId); 
          } else { setSetupError("Failed to create session on server."); }
        } catch (error) { setSetupError("Network error. Please try again."); } finally { setIsStarting(false); }
      },
      () => { setSetupError("Failed to grab GPS. Please allow location access."); setIsStarting(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const endSession = () => {
    if (window.confirm("Are you sure you want to close this session?")) {
      localStorage.removeItem('active_attendance_session');
      setActiveSessionId(null);
      setData(null);
    }
  };

  const fetchDashboardData = async () => {
    if (!activeSessionId) return;
    try {
      const response = await fetch(`/api/dashboard-data?sessionId=${activeSessionId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        console.error("Session invalid. Auto-clearing.");
        localStorage.removeItem('active_attendance_session');
        setActiveSessionId(null);
      }
    } catch (error) { console.error("Failed to fetch dashboard data"); }
  };

  useEffect(() => {
    if (activeSessionId) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [activeSessionId]);

  const handleManualOverride = async (matricNumber: string) => {
    if (!matricNumber.trim() || !activeSessionId) return;
    setIsOverriding(true);
    try {
      const response = await fetch('/api/override-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, matricNumber })
      });
      if (response.ok) { 
        setManualMatric(''); 
        fetchDashboardData(); // Instantly refresh the table
      }
    } catch (error) { console.error("Override failed:", error); } finally { setIsOverriding(false); }
  };

  const exportToCSV = () => {
    if (!data || data.logs.length === 0) return;
    const headers = ["Matric Number", "Status", "Time"];
    const rows = data.logs.map(log => [log.matricNumber, log.status.toUpperCase(), log.time]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${data.course.replace(/\s+/g, '_')}_Attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!activeSessionId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="bg-[#2563EB] text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><User size={40} /></div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome, {profile?.full_name || 'Lecturer'}</h2>
          <p className="text-[#2563EB] mt-1 text-xs font-bold uppercase tracking-widest mb-6 bg-blue-50 inline-block px-3 py-1 rounded-full">{profile?.department}</p>
          <p className="text-gray-500 text-sm font-medium mb-6">Select a course to drop a dynamic geofence at your current location.</p>
          
          {courses.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-4 text-sm font-bold text-yellow-800">No courses registered. Please go to the Course Registry.</div>
          ) : (
            <div className="relative mb-4">
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-xl py-4 pl-4 pr-10 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all appearance-none">
                {courses.map(course => (<option key={course.id} value={course.id}>{course.course_code}</option>))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500"><ChevronDown size={24} /></div>
            </div>
          )}
          <button onClick={startNewSession} disabled={isStarting || courses.length === 0} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 transition-all disabled:opacity-70">
            {isStarting ? <RefreshCw className="animate-spin" size={20} /> : <MapPin size={20} />} {isStarting ? "Anchoring..." : "Establish Dynamic Geofence"}
          </button>
          {setupError && <p className="text-sm text-red-500 font-bold mt-4">{setupError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1"><ShieldCheck size={20} className="text-[#2563EB]" /><span className="text-sm font-bold text-[#2563EB] uppercase">CampusCheck</span></div>
            <h1 className="text-3xl font-extrabold tracking-tight">Live Attendance</h1>
            <div className="flex items-center gap-2 mt-2"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span className="text-gray-500 font-bold text-lg">{data?.course || 'Loading...'}</span></div>
          </div>
          <div className="flex items-center bg-gray-50 p-3 rounded-xl border border-gray-100 gap-6">
            <div><p className="text-2xl font-extrabold text-gray-900">{data?.logs.length || 0}</p><p className="text-xs text-gray-500 font-bold uppercase">Check-ins</p></div>
            <button onClick={exportToCSV} disabled={!data || data.logs.length === 0} className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"><Download size={16} /> Export</button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?sessionId=${activeSessionId}`); alert("Link Copied!"); }} className="flex justify-center items-center gap-2 text-sm font-bold bg-white text-gray-700 px-4 py-3 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50"><Copy size={16} /> Copy Link</button>
            <button onClick={endSession} className="flex justify-center items-center gap-2 text-sm font-bold bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-200 shadow-sm hover:bg-red-100"><XCircle size={16} /> End Lecture</button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><UserPlus size={16} className="text-[#2563EB]"/> Manual Override</h3>
          <div className="flex gap-3">
            <input type="text" placeholder="MATRIC NUMBER (E.G., CSC/2021/001)" value={manualMatric} onChange={(e) => setManualMatric(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && handleManualOverride(manualMatric)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[#2563EB] uppercase" />
            <button onClick={() => handleManualOverride(manualMatric)} disabled={!manualMatric.trim() || isOverriding} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 shadow-md flex items-center gap-2">{isOverriding ? <RefreshCw className="animate-spin" size={16}/> : <ShieldCheck size={16}/>} Force Check-In</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Users size={18} /> Verified Ledger</h3><span className="text-xs text-gray-400 font-bold">Updated: {lastRefreshed}</span></div>
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400">
                <th className="px-6 py-4 font-bold">Matric Number</th>
                <th className="px-6 py-4 font-bold">Time</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-bold text-gray-900">{log.matricNumber}</td>
                  <td className="px-6 py-4 text-gray-500 flex items-center gap-2 text-sm"><Clock size={14} /> {log.time}</td>
                  <td className="px-6 py-4">
                    {log.status === 'verified' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200"><CheckCircle size={12} /> Verified</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"><AlertTriangle size={12} /> Flagged</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {log.status !== 'verified' && (
                      <button 
                        onClick={() => handleManualOverride(log.matricNumber)} 
                        disabled={isOverriding}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ShieldCheck size={14} /> Override
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}