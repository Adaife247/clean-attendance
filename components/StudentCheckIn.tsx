'use client';
import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Loader2, Navigation, User, WifiOff, RefreshCcw, ShieldCheck, Hand } from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface Telemetry { lat: number; lng: number; alt: number | null; acc: number; timestamp: number; }
interface Props { sessionId: string; }

export default function StudentCheckIn({ sessionId }: Props) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'denied' | 'failed' | 'offline-queued' | 'syncing'>('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);

  const triggerSuccessVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    if (queue.length === 0) return;
    setStatus('syncing');
    const remainingQueue = [];
    let successCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch('/api/verify-attendance', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: item.session, matricNumber: item.matric, telemetry: item.telemetry })
        });
        if (res.ok || res.status === 409) successCount++;
        else remainingQueue.push(item);
      } catch (e) { remainingQueue.push(item); }
    }
    localStorage.setItem('attendance_offline_queue', JSON.stringify(remainingQueue));
    if (successCount > 0 && remainingQueue.length === 0) { triggerSuccessVibration(); setStatus('success'); } 
    else if (remainingQueue.length > 0) setStatus('offline-queued');
  };

  useEffect(() => {
    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue(); 
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, []);

  const queueOfflinePayload = (telemetry: Telemetry[]) => {
    const existing = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    existing.push({ session: sessionId, matric: matricNumber, telemetry, timestamp: Date.now() });
    localStorage.setItem('attendance_offline_queue', JSON.stringify(existing));
    setStatus('offline-queued');
  };

  const sendPayloadToVercel = async (gpsTelemetry: Telemetry[]) => {
    setStatus('verifying');
    try {
      const response = await fetch('/api/verify-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, matricNumber, telemetry: gpsTelemetry })
      });
      const result = await response.json();
      if ((response.ok && result.status === 'verified') || response.status === 409) { triggerSuccessVibration(); setStatus('success'); } 
      else if (result.status === 'flagged') { setErrorMessage("Location anomaly detected. Please see the lecturer."); setStatus('failed'); } 
      else { setErrorMessage(result.message || "Verification failed. See lecturer."); setStatus('failed'); }
    } catch (error: any) {
      if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) queueOfflinePayload(gpsTelemetry);
      else { setErrorMessage("Server connection lost. Please try again."); setStatus('failed'); }
    }
  };

  const registerDevice = async () => {
    try {
      setStatus('locating');
      setErrorMessage("Preparing secure hardware bind...");

      const genRes = await fetch('/api/webauthn/register/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      const options = await genRes.json();
      if (options.error) throw new Error(options.error);

      const attResp = await startRegistration(options);

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: attResp })
      });
      const verifyResult = await verifyRes.json();
      
      if (verifyResult.verified) {
        alert("Hardware successfully bound! You can now check in.");
        setStatus('idle');
      } else {
        throw new Error("Hardware binding failed.");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to register your biometric device.");
      setStatus('failed');
    }
  };

  const startCheckIn = async () => {
    if (matricNumber.length < 5) return;
    setStatus('locating');
    
    // --- PHASE 1: HARDWARE BIOMETRIC BINDING ---
    try {
      const genRes = await fetch('/api/webauthn/auth/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      
      if (genRes.status === 404) {
        setErrorMessage("DEVICE NOT RECOGNIZED. You must bind this phone to your Matric Number first. Note: Doing this will trigger a 48-hour cooldown.");
        setStatus('failed');
        return;
      }

      const options = await genRes.json();
      if (options.error) throw new Error(options.error);

      const asseResp = await startAuthentication(options);
      
      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: asseResp })
      });
      
      const verifyResult = await verifyRes.json();
      if (!verifyResult.verified) throw new Error("Biometric signature mismatch.");

    } catch (error: any) {
      setErrorMessage("Hardware Validation Failed. You cannot mark attendance for this matric number from this device.");
      setStatus('failed');
      return; 
    }

    // --- PHASE 2: GPS TELEMETRY ---
    if (!navigator.geolocation) { setErrorMessage("Your browser doesn't support location services."); setStatus('failed'); return; }

    let pings: Telemetry[] = [];
    let watchId: number;
    
    const timeoutId = setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (pings.length > 0) sendPayloadToVercel(pings);
      else { setErrorMessage("We couldn't get a strong GPS lock indoors."); setStatus('failed'); }
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        pings.push({ lat: position.coords.latitude, lng: position.coords.longitude, alt: position.coords.altitude, acc: position.coords.accuracy, timestamp: position.timestamp });
        if (pings.length >= 3) { clearTimeout(timeoutId); navigator.geolocation.clearWatch(watchId); sendPayloadToVercel(pings); }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (error.code === 1) setStatus('denied');
        else { setErrorMessage("Failed to grab GPS. Ensure your location is turned on."); setStatus('failed'); }
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
    );
  };

  const requestAppeal = async () => {
    setIsAppealing(true);
    try {
      const response = await fetch('/api/request-override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, matricNumber })
      });
      if (response.ok) { alert("Appeal sent! Please look at the lecturer for visual confirmation."); setStatus('idle'); } 
      else alert("Failed to send appeal. Please check your network.");
    } catch (e) { alert("Network error."); } 
    finally { setIsAppealing(false); }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8 text-center transition-all duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#2563EB]"></div>
        <div className="flex justify-center items-center gap-2 mb-8 mt-2">
          <ShieldCheck size={28} className="text-[#2563EB]" strokeWidth={2.5} />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">CampusCheck</h1>
        </div>

        {status === 'idle' && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Student Check-In</h2>
              <p className="text-gray-500 mt-2 text-sm font-medium">Please confirm your physical presence.</p>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
              <input type="text" placeholder="Matric Number (e.g. CSC/2021/001)" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value.toUpperCase())} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium" />
            </div>
            <button onClick={startCheckIn} disabled={matricNumber.length < 5} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Navigation size={20} className="text-gray-300" /> Confirm Attendance
            </button>
          </div>
        )}

        {(status === 'locating' || status === 'verifying') && (
          <div className="py-6 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-gray-700 font-bold animate-pulse">{status === 'locating' ? "Securing connection..." : "Verifying coordinates..."}</p>
            <p className="text-xs text-gray-400 mt-2 font-medium">Do not close your browser</p>
          </div>
        )}

        {status === 'syncing' && (
          <div className="py-6 flex flex-col items-center bg-blue-50 rounded-2xl border border-blue-100">
            <RefreshCcw className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-blue-900 font-bold">Network Restored</p>
            <p className="text-blue-700 mt-1 text-sm font-medium">Syncing data to server...</p>
          </div>
        )}

        {status === 'offline-queued' && (
          <div className="py-6 bg-blue-50 rounded-2xl border border-blue-100 px-4">
            <WifiOff className="w-16 h-16 text-[#2563EB] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900">Saved Offline</h3>
            <p className="text-blue-700 mt-2 text-sm font-medium leading-relaxed">Your network connection dropped, but your GPS location was secured. Leave this tab open. It will automatically submit when your internet returns.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 bg-green-50 rounded-2xl border border-green-100">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-900">Verified</h3>
            <p className="text-green-700 mt-1 text-sm font-medium">Your attendance has been recorded.</p>
          </div>
        )}

        {status === 'denied' && (
          <div className="py-6 bg-red-50 rounded-2xl border border-red-100 px-4">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-900 leading-tight">Location Required</h3>
            <p className="text-red-700 mt-2 text-sm font-medium">Please allow location access in your browser to check in.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="py-6 bg-orange-50 rounded-2xl border border-orange-100 px-4">
            <AlertTriangle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-orange-900">Verification Failed</h3>
            <p className="text-orange-700 mt-2 text-sm font-medium">{errorMessage}</p>
            <div className="mt-6 space-y-3">
              <button onClick={() => setStatus('idle')} className="w-full bg-white text-gray-900 border border-gray-200 font-bold py-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm">Try Again</button>
              
              <button onClick={registerDevice} className="w-full bg-blue-100 text-blue-900 border border-blue-200 font-bold py-3 rounded-xl hover:bg-blue-200 active:scale-[0.98] transition-all shadow-sm">
                Bind This Phone (Setup)
              </button>

              <div className="border-t border-orange-200 pt-3 mt-3">
                <button onClick={requestAppeal} disabled={isAppealing} className="w-full flex justify-center items-center gap-2 bg-orange-100 text-orange-800 font-bold py-3 rounded-xl hover:bg-orange-200 disabled:opacity-50 transition-all shadow-sm">
                  {isAppealing ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />} Raise Hand (Digital Appeal)
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-100">
          <a href="/portal" className="text-sm font-bold text-[#2563EB] hover:text-blue-800 transition-colors">View My Exam Eligibility Status &rarr;</a>
          <p className="text-center text-xs font-semibold text-gray-400 mt-4">Secured by CampusCheck Zero-Trust Architecture</p>
        </div>
      </div>
    </div>
  );
}