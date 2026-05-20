'use client';
import { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, AlertTriangle, ShieldCheck, RefreshCw, UserPlus, Download, MapPin, Play, Copy, XCircle } from 'lucide-react';

interface Log {
  id: string;
  matricNumber: string;
  status: string;
  time: string;
}

interface DashboardData {
  course: string;
  isActive: boolean;
  logs: Log[];
}

export default function LecturerDashboard() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [courseInput, setCourseInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [manualMatric, setManualMatric] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('active_attendance_session');
    if (savedSession) setActiveSessionId(savedSession);
  }, []);

  const startNewSession = () => {
    if (!courseInput.trim()) {
      setSetupError("Please enter a course code.");
      return;
    }
    setIsStarting(true);
    setSetupError("Acquiring podium coordinates...");
    if (!navigator.geolocation) {
      setSetupError("Location services not supported by your browser.");
      setIsStarting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setSetupError("Creating database session...");
        try {
          const response = await fetch('/api/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseCode: courseInput,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
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
      },
      (error) => {
        setSetupError("Failed to grab GPS. Please allow location access.");
        setIsStarting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const endSession = () => {
    if (window.confirm("Are you sure you want to close this session? Students will no longer be able to check in.")) {
      localStorage.removeItem('active_attendance_session');
      setActiveSessionId(null);
      setData(null);
      setCourseInput('');
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
      console.error("Failed to fetch dashboard data");
    }
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
        fetchDashboardData(); 
      }
    } catch (error) {
      console.error("Override failed:", error);
    } finally {
      setIsOverriding(false);
    }
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

  const copyInviteLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?sessionId=${activeSessionId}`;
    navigator.clipboard.writeText(link);
    alert("Check-in link copied! Send this to the students.");
  };

  if (!activeSessionId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 md:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 text-center">
          <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Start Lecture</h2>
          <p className="text-gray-500 mt-2 text-sm font-medium mb-8">
            Create a secure geofence anchored to your current location.
          </p>
          <input 
            type="text" 
            placeholder="e.g. CSC 401"
            value={courseInput}
            onChange={(e) => setCourseInput(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-center font-bold text-xl py-4 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase"
          />
          <button 
            onClick={startNewSession}
            disabled={isStarting}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {isStarting ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
            {isStarting ? "Anchoring..." : "Establish Geofence"}
          </button>
          {setupError && <p className="text-sm text-red-500 font-medium mt-4">{setupError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Bulletproof Mobile Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Live Attendance</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-gray-500 font-medium">{data?.course || 'Loading...'}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100 gap-6 w-full md:w-auto">
              <div>
                <p className="text-2xl font-bold text-gray-900">{data?.logs.length || 0}</p>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Check-ins</p>
              </div>
              <button 
                onClick={exportToCSV} 
                disabled={!data || data.logs.length === 0} 
                className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Download size={16} /> Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
            <button 
              onClick={copyInviteLink} 
              className="flex justify-center items-center gap-2 text-sm font-semibold bg-white text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50"
            >
              <Copy size={16} /> Copy Link
            </button>
            <button 
              onClick={endSession} 
              className="flex justify-center items-center gap-2 text-sm font-semibold bg-red-50 text-red-600 px-4 py-2.5 rounded-xl border border-red-200 shadow-sm hover:bg-red-100"
            >
              <XCircle size={16} /> End Lecture
            </button>
          </div>
        </div>

        {/* Stacked Manual Entry Bar */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserPlus size={16} className="text-blue-600"/> Manual Override
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Matric Number (e.g., CSC/2021/001)" 
              value={manualMatric} 
              onChange={(e) => setManualMatric(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleManualOverride(manualMatric)} 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-medium focus:border-gray-400 transition-all placeholder:text-gray-400" 
            />
            <button 
              onClick={() => handleManualOverride(manualMatric)} 
              disabled={!manualMatric.trim() || isOverriding} 
              className="w-full sm:w-auto whitespace-nowrap bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
            >
              {isOverriding ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {isOverriding ? "Forcing..." : "Force Check-In"}
            </button>
          </div>
        </div>

        {/* Real-time Ledger */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-row items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Users size={18} /> Ledger
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              Updated: {lastRefreshed || 'Just now'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 md:px-6 py-4 font-semibold">Matric Number</th>
                  <th className="px-4 md:px-6 py-4 font-semibold">Time</th>
                  <th className="px-4 md:px-6 py-4 font-semibold">Status</th>
                  <th className="px-4 md:px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 md:px-6 py-12 text-center text-gray-500 font-medium">
                      Waiting for students to check in...
                    </td>
                  </tr>
                ) : (
                  data?.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-3 md:py-4 font-medium text-gray-900">{log.matricNumber}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-gray-500 flex items-center gap-2 text-sm">
                        <Clock size={14} /> {log.time}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        {log.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle size={12} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            <AlertTriangle size={12} /> Flagged
                          </span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                        {log.status !== 'verified' && (
                          <button 
                            onClick={() => handleManualOverride(log.matricNumber)} 
                            className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all"
                          >
                            <ShieldCheck size={14} /> Override
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