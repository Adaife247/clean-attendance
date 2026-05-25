'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Hand, CheckCircle, Loader2, KeyRound } from 'lucide-react';

interface Log { id: string; matricNumber: string; status: string; time: string; }

function RepPortalContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  
  const [pendingLogs, setPendingLogs] = useState<Log[]>([]);
  const [courseName, setCourseName] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const verifyPasscode = async () => {
    if (passcode.length !== 4) { setError("Passcode must be 4 digits."); return; }
    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/verify-rep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, passcode })
      });
      if (response.ok) setIsAuthenticated(true);
      else setError("Invalid passcode.");
    } catch (err) { setError("Network error."); }
    finally { setIsVerifying(false); }
  };

  const fetchPendingRequests = async () => {
    if (!sessionId || !isAuthenticated) return;
    try {
      const response = await fetch(`/api/dashboard-data?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setCourseName(data.course);
        setPendingLogs(data.logs.filter((l: Log) => l.status === 'pending_override'));
      }
    } catch (error) { console.error("Failed to fetch data"); }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingRequests();
      const interval = setInterval(fetchPendingRequests, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, sessionId]);

  const handleApprove = async (matricNumber: string) => {
    setIsProcessing(matricNumber);
    try {
      await fetch('/api/override-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, matricNumber })
      });
      fetchPendingRequests();
    } catch (err) { alert("Failed to approve."); } 
    finally { setIsProcessing(null); }
  };

  if (!sessionId) {
    return <div className="p-8 text-center text-red-500 font-bold">Invalid Link. Missing Session ID.</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="bg-[#2563EB] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
            <KeyRound size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Class Rep Access</h2>
          <p className="text-gray-500 mt-2 text-sm font-medium mb-6">Enter the 4-digit session PIN provided by the lecturer.</p>
          
          <input 
            type="text" 
            maxLength={4}
            placeholder="• • • •" 
            value={passcode} 
            onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))} 
            onKeyDown={(e) => e.key === 'Enter' && verifyPasscode()}
            className="w-full bg-gray-50 border border-gray-200 text-center text-gray-900 font-black text-3xl py-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all tracking-[0.5em]" 
          />
          {error && <p className="text-red-500 text-sm font-bold mt-3">{error}</p>}
          
          <button onClick={verifyPasscode} disabled={isVerifying || passcode.length < 4} className="w-full mt-6 flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-gray-800 disabled:opacity-50 transition-all">
            {isVerifying ? <Loader2 className="animate-spin" size={20} /> : "Unlock Portal"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#2563EB] rounded-2xl p-6 text-white shadow-md flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1"><ShieldCheck size={20} className="text-blue-200" /><span className="text-xs font-bold text-blue-200 uppercase tracking-wider">Class Rep Terminal</span></div>
            <h1 className="text-2xl font-extrabold tracking-tight">{courseName}</h1>
          </div>
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center">
            <p className="text-2xl font-black">{pendingLogs.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Pending</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <Hand size={18} className="text-orange-500" />
            <h3 className="font-bold text-gray-700">Raised Hands</h3>
          </div>

          <div className="divide-y divide-gray-50">
            {pendingLogs.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-bold">No pending appeals.</p>
                <p className="text-xs text-gray-400 mt-1">Class is running smoothly.</p>
              </div>
            ) : (
              pendingLogs.map((log) => (
                <div key={log.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-extrabold text-gray-900 text-lg">{log.matricNumber}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{log.time}</p>
                  </div>
                  <button 
                    onClick={() => handleApprove(log.matricNumber)} 
                    disabled={isProcessing === log.matricNumber}
                    className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-green-100 transition-all disabled:opacity-50"
                  >
                    {isProcessing === log.matricNumber ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Accept
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// THE SUSPENSE WRAPPER FIX
export default function ClassRepPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><Loader2 className="animate-spin text-[#2563EB]" size={32}/></div>}>
      <RepPortalContent />
    </Suspense>
  );
}