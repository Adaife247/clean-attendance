'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, ShieldCheck, CheckCircle, AlertTriangle, Loader2, Navigation } from 'lucide-react';

function StudentCheckIn() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [matricNumber, setMatricNumber] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'flagged' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [distance, setDistance] = useState<number | null>(null);

  // Focus the input automatically on load if session exists
  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage("Invalid link. Please use the exact link provided by your lecturer.");
    }
  }, [sessionId]);

  const gatherTelemetry = async () => {
    const pings: any[] = [];
    
    for (let i = 0; i < 3; i++) {
      try {
        const pos: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
          });
        });
        
        pings.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
          alt: pos.coords.altitude || 0
        });

        // Wait 800ms between pings to measure drift for the spoof catcher
        if (i < 2) await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        throw new Error("Failed to acquire high-accuracy GPS.");
      }
    }
    return pings;
  };

  const handleCheckIn = async () => {
    if (!matricNumber.trim()) {
      setMessage("Please enter your matric number.");
      return;
    }
    
    try {
      setStatus('locating');
      setMessage("Acquiring satellite lock. Do not close this page...");
      
      const telemetry = await gatherTelemetry();

      setStatus('verifying');
      setMessage("Running zero-trust verification...");

      const response = await fetch('/api/verify-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          matricNumber: matricNumber.toUpperCase().trim(),
          telemetry
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === 'verified') {
          setStatus('success');
        } else {
          setStatus('flagged');
        }
        setMessage(data.message);
        if (data.distance) setDistance(data.distance);
      } else {
        setStatus('error');
        setMessage(data.message || "Verification failed. Please try again.");
      }

    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || "An unexpected error occurred.");
    }
  };

  // --- UI STATES ---
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900">No Session Found</h1>
          <p className="text-gray-500 mt-2 text-sm">Please scan the QR code or use the exact link provided by your lecturer.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-green-100 max-w-sm w-full transform transition-all scale-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600" size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Verified!</h1>
          <p className="text-green-700 font-bold mt-2 bg-green-50 px-4 py-2 rounded-xl inline-block uppercase tracking-wider text-sm border border-green-100">
            {matricNumber}
          </p>
          <p className="text-gray-500 mt-6 text-sm font-medium">You have been successfully checked in. You may close this page.</p>
        </div>
      </div>
    );
  }

  if (status === 'flagged') {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-red-100 max-w-sm w-full">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="text-red-600" size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Verification Failed</h1>
          <p className="text-red-600 font-bold mt-3 text-sm">{message}</p>
          {distance && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500 font-bold uppercase">Recorded Distance</p>
              <p className="text-2xl font-black text-gray-900">{distance}m</p>
            </div>
          )}
          <button 
            onClick={() => setStatus('idle')}
            className="mt-8 w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-2 font-medium">Student Check-In Portal</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8">
          
          {status === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl text-center">
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
              <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                <Navigation size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Matric Number (e.g., CSC/2021/001)"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                disabled={status === 'locating' || status === 'verifying'}
                className="w-full bg-transparent text-gray-900 font-bold py-4 pr-4 outline-none placeholder:text-gray-400 text-sm uppercase"
              />
            </div>

            <button 
              onClick={handleCheckIn}
              disabled={status === 'locating' || status === 'verifying' || !matricNumber.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-80"
            >
              {status === 'locating' ? (
                <><Loader2 className="animate-spin" size={20} /> Acquiring GPS...</>
              ) : status === 'verifying' ? (
                <><Loader2 className="animate-spin" size={20} /> Verifying...</>
              ) : (
                <><MapPin size={20} /> Verify Attendance</>
              )}
            </button>
          </div>
        </div>
        
        <p className="text-center text-xs font-semibold text-gray-400 mt-8">
          Make sure you are physically inside the lecture hall before checking in.
        </p>
      </div>
    </div>
  );
}

// Next.js requirement for pages using useSearchParams
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32}/></div>}>
      <StudentCheckIn />
    </Suspense>
  );
}