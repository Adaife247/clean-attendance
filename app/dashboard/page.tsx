'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Clock, CheckCircle, AlertTriangle, ShieldCheck, 
  RefreshCw, UserPlus, Download, MapPin, Copy, XCircle, 
  User, ChevronDown, Archive, Hand, Trash2, KeyRound 
} from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
  const [isResetting, setIsResetting] = useState(false);

  const [viewMode, setViewMode] = useState<'live' | 'history'>('live');
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  useEffect(() => {
    const savedSession = localStorage.getItem('active_attendance_session');
    if (savedSession) setActiveSessionId(savedSession);
  }, []);

  const loadHistory = async () => {
    const course = courses.find(c => c.id === selectedCourseId);
    if (!course) return;
    try {
      const response = await fetch(`/api/attendance-history?courseCode=${course.course_code}`);
      if (response.ok) {
        setPastSessions(await response.json());
      }
    } catch (e) {
      console.error("Failed to load history");
    }
  };

  useEffect(() => { 
    if (viewMode === 'history') loadHistory(); 
  }, [viewMode, selectedCourseId]);

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
          setViewMode('live'); 
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
        setSetupError("Hardware Timeout: Ensure your phone's global Location/GPS is turned ON."); 
        setIsStarting(false); 
      }
    }, 8000); 

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentAcc = position.coords.accuracy;
        if (currentAcc < bestAcc) {
            bestAcc = currentAcc;
            bestLat = position.coords.latitude;
            bestLng = position.coords.longitude;
            setSetupError(`Calibrating... Accuracy: ${Math.round(bestAcc)}m`);
        }
        if (bestAcc <= 60) {
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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  const endSession = () => {
    if (window.confirm("Are you sure you want to close this session? Students will no longer be able to check in.")) {
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
      }
    } catch (error) { 
      console.error("Failed to fetch data"); 
    }
  };

  useEffect(() => {
    if (activeSessionId && viewMode === 'live') {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [activeSessionId, viewMode]);

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

  const handleDeviceReset = async (targetMatric: string) => {
    const safeMatric = String(targetMatric || "").trim();
    if (!safeMatric) { alert("❌ Please enter a matric number first."); return; }
    if (!window.confirm(`Wipe biometric hardware lock for ${safeMatric}? They will need to re-register on a new phone.`)) return;

    setIsResetting(true);
    try {
      const response = await fetch('/api/reset-device', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: safeMatric })
      });
      if (response.ok) { 
        alert(`✅ Hardware binding completely wiped for ${safeMatric}.`); 
        setManualMatric(''); 
      } else { 
        const errorData = await response.json(); 
        alert(`⚠️ Failed: ${errorData.message}`); 
      }
    } catch (err: any) { 
      alert("💥 Network Error."); 
    } finally { 
      setIsResetting(false); 
    }
  };

  const generateAndDownloadCSV = (logsToExport: Log[], courseName: string, dateStr: string, isArchive: boolean) => {
    if (!logsToExport || logsToExport.length === 0) { 
      alert("No check-ins recorded."); 
      return; 
    }
    const verifiedCount = logsToExport.filter(l => l.status === 'verified').length;
    const header = [
      [`OFFICIAL ATTENDANCE REPORT ${isArchive ? '(ARCHIVED)' : ''}`], 
      ["Course Code", courseName], 
      ["Date Generated", dateStr], 
      ["Total Present", verifiedCount], 
      ["Total Records Logged", logsToExport.length], 
      [], 
      ["Matric Number", "Status", "Timestamp", "Security Flag"]
    ];
    const rows = logsToExport
      .sort((a, b) => a.matricNumber.localeCompare(b.matricNumber))
      .map(log => [log.matricNumber, log.status.toUpperCase(), log.time, "Verified via Secure Platform"]);
    
    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${courseName.replace(/\s+/g, '_')}_Attendance_${dateStr.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  const exportLiveCSV = () => { 
    if (!data) return; 
    generateAndDownloadCSV(data.logs, data.course, new Date().toLocaleDateString(), false); 
  };

  const downloadPastSession = async (sessionId: string, dateString: string) => {
    setDownloadingId(sessionId);
    try {
      const response = await fetch(`/api/dashboard-data?sessionId=${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const pastData = await response.json();
      generateAndDownloadCSV(pastData.logs, pastData.course, dateString, true);
    } catch (e) { 
      alert("Failed to download. Check network."); 
    } finally { 
      setDownloadingId(null); 
    }
  };

  // --- UNIFIED COPY FUNCTION ---
  const copySessionInfo = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?sessionId=${activeSessionId}`;
    const passcode = data?.repPasscode || 'N/A';
    
    const clipboardText = `📌 Attendance Link:\n${link}\n\n🔑 Class Rep PIN: ${passcode}\n(If you are the Class Rep, open the link and click 'Class Rep Login' at the bottom)`;
    
    navigator.clipboard.writeText(clipboardText);
    alert("Session info copied! Send this to the Class Rep.");
  };

  if (!activeSessionId || viewMode === 'history') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 md:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 text-center">
          <div className="bg-[#2563EB] text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <User size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome, {profile?.full_name || 'Lecturer'}</h2>
          <p className="text-[#2563EB] mt-1 text-xs font-bold uppercase tracking-widest mb-6 bg-blue-50 inline-block px-3 py-1 rounded-full">
            {profile?.department || 'Faculty Member'}
          </p>

          <div className="flex bg-gray-50 p-1 rounded-xl mb-6">
            <button 
              onClick={() => { setViewMode('live'); setActiveSessionId(localStorage.getItem('active_attendance_session')); }} 
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'live' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Start Class
            </button>
            <button 
              onClick={() => { setViewMode('history'); setActiveSessionId('vault'); }} 
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Past Records
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-4">
              <AlertTriangle className="mx-auto text-yellow-600 mb-2" size={24} />
              <p className="text-sm font-bold text-yellow-800">No courses registered.</p>
              <p className="text-xs text-yellow-700 mt-1">Please go to the Course Registry to create one first.</p>
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

          {viewMode === 'live' ? (
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
          ) : (
            <div className="text-left border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/30">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Archive size={16}/> Vault Archive</h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {pastSessions.length === 0 ? (
                  <p className="p-6 text-center text-sm font-bold text-gray-400">No past records found for this course.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pastSessions.map(session => (
                      <div key={session.session_id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900">{new Date(session.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500 font-medium">{new Date(session.created_at).toLocaleTimeString()}</p>
                        </div>
                        <button 
                          onClick={() => downloadPastSession(session.session_id, new Date(session.created_at).toLocaleDateString())} 
                          disabled={downloadingId === session.session_id} 
                          className="flex items-center gap-1.5 text-xs font-bold text-[#2563EB] bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          {downloadingId === session.session_id ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} 
                          {downloadingId === session.session_id ? 'Pulling...' : 'Download'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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
                <Download size={16} /> Export
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
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserPlus size={16} className="text-[#2563EB]"/> Student Management
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Matric Number (e.g., CSC/2021/001)" 
              value={manualMatric} 
              onChange={(e) => setManualMatric(e.target.value.toUpperCase())} 
              onKeyDown={(e) => e.key === 'Enter' && handleManualOverride(manualMatric)} 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB] transition-all placeholder:text-gray-400 placeholder:font-medium uppercase" 
            />
            <div className="flex gap-2">
              <button 
                onClick={() => handleManualOverride(manualMatric)} 
                disabled={!manualMatric.trim() || isOverriding} 
                className="whitespace-nowrap bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-md"
              >
                {isOverriding ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                {isOverriding ? "Forcing..." : "Force Check-In"}
              </button>
              <button 
                onClick={() => handleDeviceReset(manualMatric)} 
                disabled={!manualMatric.trim() || isResetting} 
                className="whitespace-nowrap bg-red-50 text-red-600 px-4 py-3 rounded-xl font-bold text-sm border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-all flex justify-center items-center gap-2" 
                title="Wipe hardware lock if student bought a new phone"
              >
                {isResetting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />} 
                Wipe Biometrics
              </button>
            </div>
          </div>
        </div>

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