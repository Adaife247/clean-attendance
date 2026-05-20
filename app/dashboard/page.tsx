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
  // Phase Management State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // Setup Screen State
  const [courseInput, setCourseInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Ledger State
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [manualMatric, setManualMatric] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  // Check if an active session survived a page refresh
  useEffect(() => {
    const savedSession = localStorage.getItem('active_attendance_session');
    if (savedSession) setActiveSessionId(savedSession);
  }, []);

  // --- PHASE 1: SESSION CREATION ---
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

    // Grab the lecturer's exact coordinates to anchor the geofence
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
        } finaly {
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

  // Close the active geofenced session
  const endSession = () => {
    if (window.confirm("Are you sure you want to close this session? Students will no longer be able to check in.")) {
      localStorage.removeItem('active_attendance_session');
      setActiveSessionId(null);
      setData(null);
      setCourseInput('');
    }
  };

  // --- PHASE 2: LIVE LEDGER ENGINE ---
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

  // Poll the database every 3 seconds for active sessions
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

  // FIX: Dynamic domain resolution for sharing with students
  const copyInviteLink = () => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?sessionId=${activeSessionId}`;
    
    navigator.clipboard.writeText(link);
    alert("Check-in link copied! Send this to the students.");
  };

  // --- RENDER PHASE 1: SETUP SCREEN ---
  if (!activeSessionId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 text-center">
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

  // --- RENDER PHASE 2: LIVE LEDGER DASHBOARD ---
  return (
    <div className="min-h-screen bg-[#F9FAFB] p-8 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Console */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Attendance</h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-gray-500 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {data?.course || 'Loading...'}
              </p>
              <button 
                onClick={copyInviteLink} 
                className="flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-200 transition-colors border border-gray-200"
              >
                <Copy size={12} /> Copy Student Link
              </button>
              <button 
                onClick={endSession} 
                className="flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors border border-red-200 ml-2"
              >
                <XCircle size={12} /> End Lecture
              </button>
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div className="text-right">
              <p className="text-3xl font-bold">{data?.logs.length || 0}</p>
              <p className="text-sm text-gray-500 font-medium">Total Check-ins</p>
            </div>
            <button 
              onClick={exportToCSV} 
              disabled={!data || data.logs.length === 0} 
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
            >
              <Download size={18} /> Export CSV
            </button>
          </div>
        </div>

        {/* Device Failure Manual Entry Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex gap-3 items-center">
          <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
            <UserPlus size={20} />
          </div>
          <input 
            type="text" 
            placeholder="Enter Matric Number (e.g., CSC/2021/001)" 
            value={manualMatric} 
            onChange={(e) => setManualMatric(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleManualOverride(manualMatric)} 
            className="flex-1 bg-transparent border-none outline-none font-medium placeholder:text-gray-400 focus:ring-0" 
          />
          <button 
            onClick={() => handleManualOverride(manualMatric)} 
            disabled={!manualMatric.trim() || isOverriding} 
            className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all"
          >
            {isOverriding ? <RefreshCw size={18} className="animate-spin" /> : "Force Check-In"}
          </button>
        </div>

        {/* Real-time Ledger Ledger */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Users size={18} /> Student Ledger
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              Last updated: {lastRefreshed}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-semibold">Matric Number</th>
                  <th className="px-6 py-4 font-semibold">Time</th>
                  <th className="px-6 py-4 font-semibold">System Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                      Waiting for students to check in...
                    </td>
                  </tr>
                ) : (
                  data?.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{log.matricNumber}</td>
                      <td className="px-6 py-4 text-gray-500 flex items-center gap-2 text-sm">
                        <Clock size={14} /> {log.time}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-right">
                        {log.status !== 'verified' && (
                          <button 
                            onClick={() => handleManualOverride(log.matricNumber)} 
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all"
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