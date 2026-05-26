'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Clock, CheckCircle, AlertTriangle, ShieldCheck, 
  RefreshCw, UserPlus, Download, MapPin, Copy, XCircle, 
  User, ChevronDown, Hand, KeyRound 
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Log { id: string; matricNumber: string; status: string; time: string; }
interface DashboardData { course: string; isActive: boolean; repPasscode: string; logs: Log[]; }
interface LecturerProfile { full_name: string; department: string; }
interface Course { id: string; course_code: string; }

export default function LecturerDashboard() {
  const router = useRouter();

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

  // 1. Secure Page & Fetch Profile
  useEffect(() => {
    const securePageAndFetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        window.location.href = '/login'; 
        return; 
      }

      const { data: profileData } = await supabase
        .from('lecturers')
        .select('full_name, department')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile({ full_name: profileData.full_name, department: profileData.department });
      }

      const { data: courseData } = await supabase
        .from('courses')
        .select('id, course_code')
        .eq('lecturer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (courseData) {
        setCourses(courseData);
        if (courseData.length > 0) setSelectedCourseId(courseData[0].id);
      }
    };
    securePageAndFetchProfile();
  }, []);

  // 2. Check for active session on load
  useEffect(() => {
    const savedSession = localStorage.getItem('active_attendance_session');
    if (savedSession) setActiveSessionId(savedSession);
  }, []);

  // 3. Start a New Live Session
  const startNewSession = () => {
    if (!selectedCourseId) { 
      setSetupError("Please register a course first."); 
      return; 
    }
    setIsStarting(true);
    setSetupError("Waking up GPS hardware...");
    
    if (!navigator.geolocation) { 
      setSetupError("Location services not supported by your browser."); 
      setIsStarting(false); 
      return; 
    }
    
    let watchId: number;
    let bestLat = 0;
    let bestLng = 0;
    let bestAcc = 9999;

    const executeSessionCreation = async (lat: number, lng: number) => {
      setSetupError("Coordinates secured. Creating session...");
      try {
        const response = await fetch('/api/create-session', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: selectedCourseId, 
            courseCode: courses.find(c => c.id === selectedCourseId)?.course_code,
            latitude: lat, 
            longitude: lng
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          localStorage.setItem('active_attendance_session', result.sessionId);
          setActiveSessionId(result.sessionId); 
        } else { 
          setSetupError("Failed to create session on server."); 
        }
      } catch (error) { 
        setSetupError("Network error. Please try again."); 
      } finally { 
        setIsStarting(false); 
      }
    };
    
    const timeoutId = setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      
      if (bestAcc !== 9999) {
        executeSessionCreation(bestLat, bestLng);
      } else { 
        setSetupError("Hardware Timeout: Ensure your phone's global Location/GPS is turned ON and try near a window."); 
        setIsStarting(false); 
      }
    }, 15000); 

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentAcc = position.coords.accuracy;
        if (currentAcc < bestAcc) {
            bestAcc = currentAcc;
            bestLat = position.coords.latitude;
            bestLng = position.coords.longitude;
            setSetupError(`Calibrating... Accuracy: ${Math.round(bestAcc)}m`);
        }
        
        if (bestAcc <= 150) {
            clearTimeout(timeoutId);
            navigator.geolocation.clearWatch(watchId); 
            executeSessionCreation(bestLat, bestLng);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (error.code === 1) setSetupError("Permission Denied: You must click 'Allow' for location.");
        else if (error.code === 2) setSetupError("Signal Lost: Turn on your phone's GPS/Location.");
        else if (error.code === 3) setSetupError("Timeout: GPS took too long indoors.");
        else setSetupError("Failed to grab GPS.");
        setIsStarting(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  // 4. End Live Session
  const endSession = () => {
    if (window.confirm("Are you sure you want to close this session? Students will no longer be able to check in.")) {
      localStorage.removeItem('active_attendance_session');
      setActiveSessionId(null);
      setData(null);
    }
  };

  // 5. Fetch Live Data Loop
  const fetchDashboardData = async () => {
    if (!activeSessionId) return;
    try {
      const response = await fetch(`/api/dashboard-data?sessionId=${activeSessionId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (error) { 
      console.error("Failed to fetch data"); 
    }
  };

  useEffect(() => {
    if (activeSessionId) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [activeSessionId]);

  // 6. Manual Override Logic
  const handleManualOverride = async (targetMatric: string) => {
    try {
      if (!activeSessionId) { alert("❌ Error: Missing Session ID"); return; }
      const safeMatric = String(targetMatric || "").trim();
      if (!safeMatric) { alert("❌ Error: Matric number is empty!"); return; }

      setIsOverriding(true);
      const response = await fetch('/api/override-attendance', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, matricNumber: safeMatric })
      });
      
      if (response.ok) { 
        setManualMatric(''); 
        fetchDashboardData(); 
      } else { 
        alert(`⚠️ SERVER REJECTED IT! Status: ${response.status}`); 
      }
    } catch (err: any) { 
      alert("💥 CRITICAL CRASH: " + err.message); 
    } finally { 
      setIsOverriding(false); 
    }
  };

  // 7. Live CSV Export (Saves just this active class)
  const exportLiveCSV = () => { 
    if (!data || data.logs.length === 0) { 
      alert("No check-ins recorded."); 
      return; 
    }
    
    const verifiedCount = data.logs.filter(l => l.status === 'verified').length;
    const dateStr = new Date().toLocaleDateString();
    
    const header = [
      [`LIVE ATTENDANCE REPORT`], 
      ["Course Code", data.course], 
      ["Date Generated", dateStr], 
      ["Total Present", verifiedCount], 
      ["Total Records Logged", data.logs.length], 
      [], 
      ["Matric Number", "Status", "Timestamp", "Security Flag"]
    ];
    
    const rows = data.logs
      .sort((a, b) => a.matricNumber.localeCompare(b.matricNumber))
      .map(log => [
        log.matricNumber, 
        log.status.toUpperCase(), 
        log.time, 
        "Verified via Secure Platform"
      ]);
    
    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${data.course.replace(/\s+/g, '_')}_Live_Attendance_${dateStr.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  // 8. Copy Invite Info
  const copySessionInfo = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?sessionId=${activeSessionId}`;
    const passcode = data?.repPasscode || 'N/A';
    
    const clipboardText = `📌 Attendance Link:\n${link}\n\n🔑 Class Rep PIN: ${passcode}\n(If you are the Class Rep, open the link and click 'Class Rep Login' at the bottom)`;
    
    navigator.clipboard.writeText(clipboardText);
    alert("Session info copied! Send this to the Class Rep.");
  };

  // ==========================================
  // UI STATE 1: NO ACTIVE SESSION (Setup Mode)
  // ==========================================
  if (!activeSessionId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 md:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 text-center">
          <div className="bg-[#2563EB] text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <User size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome, {profile?.full_name || 'Lecturer'}</h2>
          <p className="text-[#2563EB] mt-1 text-xs font-bold uppercase tracking-widest mb-8 bg-blue-50 inline-block px-3 py-1 rounded-full">
            {profile?.department || 'Faculty Member'}
          </p>

          {courses.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-4">
              <AlertTriangle className="mx-auto text-yellow-600 mb-2" size={24} />
              <p className="text-sm font-bold text-yellow-800">No courses registered.</p>
              <p className="text-xs text-yellow-700 mt-1">Please go to the Student Management tab to create one first.</p>
            </div>
          ) : (
            <div className="relative mb-6">
              <select 
                value={selectedCourseId} 
                onChange={(e) => setSelectedCourseId(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-xl py-4 pl-4 pr-10 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all appearance-none cursor-pointer"
              >
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.course_code}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500">
                <ChevronDown size={24} strokeWidth={2.5} />
              </div>
            </div>
          )}

          <div>
            <button 
              onClick={startNewSession} 
              disabled={isStarting || courses.length === 0} 
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {isStarting ? <RefreshCw className="animate-spin" size={20} /> : <MapPin size={20} />} 
              {isStarting ? "Anchoring Geofence..." : "Establish Dynamic Geofence"}
            </button>
            {setupError && <p className="text-sm text-red-500 font-bold mt-4">{setupError}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // UI STATE 2: ACTIVE SESSION (Live Radar)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* TOP STATUS BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={20} className="text-[#2563EB]" />
                <span className="text-sm font-bold text-[#2563EB] uppercase tracking-wider">CampusCheck • {profile?.full_name || 'Faculty'}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Live Radar</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-gray-500 font-bold text-lg">{data?.course || 'Loading...'}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 gap-6 w-full md:w-auto mt-2 md:mt-0">
              <div>
                <p className="text-2xl font-extrabold text-gray-900">{data?.logs.length || 0}</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Check-ins</p>
              </div>
              <button 
                onClick={exportLiveCSV} 
                disabled={!data || data.logs.length === 0} 
                className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                <Download size={16} /> Export Live Data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
            <button 
              onClick={copySessionInfo} 
              className="flex justify-center items-center gap-2 text-sm font-bold bg-white text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <Copy size={16} /> Share Session Info
            </button>
            <button 
              onClick={endSession} 
              className="flex justify-center items-center gap-2 text-sm font-bold bg-red-50 text-red-600 px-4 py-2.5 rounded-xl border border-red-200 shadow-sm hover:bg-red-100 active:scale-[0.98] transition-all"
            >
              <XCircle size={16} /> End Lecture
            </button>
          </div>

          {/* CLASS REP WIDGET */}
          {data?.repPasscode && (
            <div className="bg-blue-50 p-4 md:p-5 rounded-xl border border-blue-100 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                  <KeyRound size={18} /> Class Rep Access
                </h3>
                <p className="text-blue-700 text-sm mt-1 font-medium">Delegate manual override approvals to the class rep.</p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 shadow-sm">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Session PIN</p>
                  <p className="text-xl font-black text-blue-900 tracking-widest">{data.repPasscode}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MANUAL OVERRIDE INPUT */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserPlus size={16} className="text-[#2563EB]"/> Live Manual Override
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Matric Number (e.g., CSC/2021/001)" 
              value={manualMatric} 
              onChange={(e) => setManualMatric(e.target.value.toUpperCase())} 
              onKeyDown={(e) => e.key === 'Enter' && handleManualOverride(manualMatric)} 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] transition-all uppercase" 
            />
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => handleManualOverride(manualMatric)} 
                disabled={!manualMatric.trim() || isOverriding} 
                className="w-full sm:w-auto whitespace-nowrap bg-gray-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-md"
              >
                {isOverriding ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                {isOverriding ? "Forcing Status..." : "Grant Manual Override"}
              </button>
            </div>
          </div>
        </div>

        {/* LIVE VERIFIED LEDGER */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-row items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Users size={18} /> Verified Ledger
            </h3>
            <span className="text-xs text-gray-400 font-bold">
              Updated: {lastRefreshed || 'Just now'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 md:px-6 py-4 font-bold">Matric Number</th>
                  <th className="px-4 md:px-6 py-4 font-bold">Time</th>
                  <th className="px-4 md:px-6 py-4 font-bold">Status</th>
                  <th className="px-4 md:px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 md:px-6 py-12 text-center text-gray-400 font-bold">
                      Waiting for students to check in...
                    </td>
                  </tr>
                ) : (
                  data?.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-3 md:py-4 font-bold text-gray-900">{log.matricNumber}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-gray-500 flex items-center gap-2 text-sm font-medium">
                        <Clock size={14} /> {log.time}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {log.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle size={12} strokeWidth={2.5} /> Verified
                          </span>
                        ) : log.status === 'pending_override' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                            <Hand size={12} strokeWidth={2.5} /> Raised Hand
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <AlertTriangle size={12} strokeWidth={2.5} /> Flagged
                          </span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                        {log.status !== 'verified' && (
                          <button 
                            onClick={() => handleManualOverride(log.matricNumber)} 
                            className="inline-flex items-center justify-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all"
                          >
                            <ShieldCheck size={14} /> Accept
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}