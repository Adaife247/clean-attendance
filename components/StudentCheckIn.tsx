'use client';
import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Loader2, Navigation, User, WifiOff, ShieldCheck, Hand, ArrowRight, RefreshCw } from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface Telemetry { lat: number; lng: number; alt: number | null; acc: number; timestamp: number; }
interface Props { sessionId: string; }

export default function StudentCheckIn({ sessionId }: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'needs_setup' | 'ready' | 'locating' | 'verifying' | 'success' | 'denied' | 'failed' | 'offline-queued' | 'syncing'>('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);

  const triggerSuccessVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const generateHardwareFingerprint = async () => {
    try {
      const nav = window.navigator as any;
      const components = [
        nav.userAgent,
        nav.language,
        window.screen.colorDepth,
        window.screen.width + 'x' + window.screen.height,
        nav.hardwareConcurrency || 'unknown',
        nav.deviceMemory || 'unknown',
        new Date().getTimezoneOffset()
      ];
      const rawHash = components.join('|||');
      const msgBuffer = new TextEncoder().encode(rawHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return 'unknown-hardware';
    }
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
          body: JSON.stringify({ sessionId: item.session, matricNumber: item.matric, telemetry: item.telemetry, hardwareFingerprint: item.hardwareFingerprint })
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

  const checkStudentStatus = async () => {
    if (matricNumber.length < 5) return;
    setStatus('checking');
    
    try {
      const res = await fetch('/api/webauthn/auth/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      
      if (res.status === 404) setStatus('needs_setup'); 
      else if (res.ok) setStatus('ready'); 
      else throw new Error("Failed to verify ledger.");
    } catch (error) {
      setErrorMessage("Network error. Could not connect to database.");
      setStatus('failed');
    }
  };

  const registerDevice = async () => {
    try {
      const existingAnchor = localStorage.getItem('campuscheck_device_anchor');
      if (existingAnchor && existingAnchor !== matricNumber) {
        setErrorMessage(`Security Block: This physical device is already bound to ${existingAnchor}.`);
        setStatus('failed');
        return;
      }

      setStatus('locating');
      const hf = await generateHardwareFingerprint();

      const genRes = await fetch('/api/webauthn/register/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, hardwareFingerprint: hf })
      });
      
      const options = await genRes.json();
      if (!genRes.ok || options.error) {
         throw new Error(options.error || "Server rejected registration.");
      }

      const attResp = await startRegistration(options);

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: attResp, hardwareFingerprint: hf })
      });
      const verifyResult = await verifyRes.json();
      
      if (verifyResult.verified) {
        localStorage.setItem('campuscheck_device_anchor', matricNumber);
        setStatus('ready');
      }
      else throw new Error("Hardware binding failed.");
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to register your biometric device.");
      setStatus('failed');
    }
  };

  const executeFinalCheckIn = async () => {
    setStatus('locating');
    
    try {
      const genRes = await fetch('/api/webauthn/auth/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      const options = await genRes.json();
      
      if (options.error) throw new Error(`Generate Error: ${options.error}`);

      const asseResp = await startAuthentication(options);
      
      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: asseResp })
      });
      const verifyResult = await verifyRes.json();
      
      if (verifyResult.error) throw new Error(`Verify Error: ${verifyResult.error}`);
      if (!verifyResult.verified) throw new Error("Biometric signature did not match.");

    } catch (error: any) {
      setErrorMessage(error.message || "Unknown Auth Error occurred.");
      setStatus('failed');
      return; 
    }

    if (!navigator.geolocation) { setErrorMessage("Browser doesn't support location."); setStatus('failed'); return; }

    let pings: Telemetry[] = [];
    let watchId: number;
    let bestAcc = 9999;
    
    const timeoutId = setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (pings.length > 0) sendPayloadToVercel(pings);
      else { setErrorMessage("Couldn't get any location data. Pull down your menu and turn on Location/GPS."); setStatus('failed'); }
    }, 8000); 

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentAcc = position.coords.accuracy;
        if (currentAcc < bestAcc) bestAcc = currentAcc;

        pings.push({ lat: position.coords.latitude, lng: position.coords.longitude, alt: position.coords.altitude, acc: position.coords.accuracy, timestamp: position.timestamp });
        
        if (pings.length >= 3 && bestAcc <= 100) { 
            clearTimeout(timeoutId); 
            navigator.geolocation.clearWatch(watchId); 
            sendPayloadToVercel(pings); 
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (error.code === 1) setStatus('denied');
        else { setErrorMessage(`GPS Blocked (Code ${error.code}). Pull down your menu and turn on Location.`); setStatus('failed'); }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  const sendPayloadToVercel = async (gpsTelemetry: Telemetry[]) => {
    setStatus('verifying');
    try {
      const hardwareFingerprint = await generateHardwareFingerprint();

      const response = await fetch('/api/verify-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, matricNumber, telemetry: gpsTelemetry, hardwareFingerprint })
      });
      const result = await response.json();
      
      if ((response.ok && result.status === 'verified') || response.status === 409) { 
        triggerSuccessVibration(); 
        setStatus('success'); 
      } 
      else if (result.status === 'flagged' || response.status === 403) { 
        setErrorMessage(result.message || "Verification failed."); 
        setStatus('failed'); 
      } 
      else { 
        setErrorMessage(result.message || "Verification failed."); 
        setStatus('failed'); 
      }
    } catch (error: any) {
      if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        const hf = await generateHardwareFingerprint();
        const existing = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
        existing.push({ session: sessionId, matric: matricNumber, telemetry: gpsTelemetry, hardwareFingerprint: hf, timestamp: Date.now() });
        localStorage.setItem('attendance_offline_queue', JSON.stringify(existing));
        setStatus('offline-queued');
      }
      else { setErrorMessage("Server connection lost."); setStatus('failed'); }
    }
  };

  const requestAppeal = async () => {
    setIsAppealing(true);
    try {
      const response = await fetch('/api/request-override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, matricNumber })
      });
      if (response.ok) { alert("Appeal sent! Please look at the lecturer for visual confirmation."); setStatus('idle'); } 
      else alert("Failed to send appeal. Check network.");
    } catch (e) { alert("Network error."); } 
    finally { setIsAppealing(false); }
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8 relative overflow-hidden">
        
        {status === 'idle' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
              <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                <User size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Matric Number (e.g., CSC/2021/001)"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && checkStudentStatus()}
                className="w-full bg-transparent text-gray-900 font-bold py-4 pr-4 outline-none placeholder:text-gray-400 text-sm uppercase"
              />
            </div>
            <button 
              onClick={checkStudentStatus}
              disabled={matricNumber.length < 5}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Continue <ArrowRight size={20} className="text-gray-300" />
            </button>
          </div>
        )}

        {status === 'needs_setup' && (
          <div className="space-y-4 text-center animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <ShieldCheck size={32} className="text-[#2563EB]" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Hardware Setup</h3>
            <p className="text-gray-600 mt-3 text-sm font-medium leading-relaxed">
              We need to securely link this specific phone to <span className="font-bold text-gray-900">{matricNumber}</span> to prevent proxy attendance.
            </p>
            <button onClick={registerDevice} className="w-full mt-4 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
              Scan Biometrics
            </button>
            <button onClick={() => setStatus('idle')} className="w-full text-gray-500 font-bold py-3 hover:text-gray-800 transition-all text-sm">Cancel</button>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-4 text-center animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Identity Confirmed</h3>
            <p className="text-gray-900 font-black text-xl mt-1">{matricNumber}</p>
            <p className="text-gray-500 mt-2 text-sm font-medium leading-relaxed">
              Your device is securely linked. Ensure you are inside the lecture hall.
            </p>
            <button onClick={executeFinalCheckIn} className="w-full mt-4 bg-gray-900 text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
              <Navigation size={20} /> Submit Attendance
            </button>
            <button onClick={() => setStatus('idle')} className="w-full text-gray-500 font-bold py-3 hover:text-gray-800 transition-all text-sm">Not you? Switch account</button>
          </div>
        )}

        {(status === 'checking' || status === 'locating' || status === 'verifying' || status === 'syncing') && (
          <div className="py-8 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-gray-700 font-bold animate-pulse text-center">
              {status === 'checking' ? "Verifying ledger..." : status === 'locating' ? "Acquiring hardware lock..." : status === 'syncing' ? "Syncing offline data..." : "Verifying coordinates..."}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900">Verified!</h3>
            <p className="text-green-700 font-bold mt-2 bg-green-50 px-4 py-2 rounded-xl inline-block uppercase tracking-wider text-sm border border-green-100">{matricNumber}</p>
            <p className="text-gray-500 mt-4 text-sm font-medium">Attendance recorded. You may close this page.</p>
          </div>
        )}

        {status === 'offline-queued' && (
          <div className="py-6 bg-blue-50 rounded-2xl border border-blue-100 px-4 text-center">
            <WifiOff className="w-16 h-16 text-[#2563EB] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900">Saved Offline</h3>
            <p className="text-blue-700 mt-2 text-sm font-medium leading-relaxed">Network dropped, but GPS secured. Keep this tab open. It will auto-submit when internet returns.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Verification Failed</h3>
            
            <p className="text-orange-600 mt-2 text-sm font-bold bg-orange-50 p-3 rounded-xl border border-orange-100">
              {errorMessage.includes("out of bounds") 
                ? "You are too far away. You must be inside the lecture hall to check in." 
                : errorMessage.includes("Location Blocked") || errorMessage.includes("any location data") || errorMessage.includes("pull down")
                ? "Your GPS is off or blocked. Pull down your phone menu, turn on Location, and click Try Again."
                : errorMessage}
            </p>

            <div className="mt-6 space-y-3">
              {/* Only show "Try Again" if it was a GPS glitch, not if they are sitting in their hostel */}
              {!errorMessage.includes("out of bounds") && (
                <button onClick={executeFinalCheckIn} className="w-full flex justify-center items-center gap-2 bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all shadow-md">
                  <RefreshCw size={18} /> Try Again (Reset GPS)
                </button>
              )}
              
              <button onClick={() => setStatus('idle')} className="w-full bg-white text-gray-900 border border-gray-200 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                Start Over Completely
              </button>

              {/* The strict appeal button - totally hidden if out of bounds */}
              {!errorMessage.includes("out of bounds") && (
                <button onClick={requestAppeal} disabled={isAppealing} className="w-full flex justify-center items-center gap-2 bg-orange-50 text-orange-800 font-bold py-3.5 rounded-xl hover:bg-orange-100 disabled:opacity-50 transition-all border border-orange-100 mt-4">
                  {isAppealing ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />} 
                  Raise Hand (I am in the hall)
                </button>
              )}
            </div>
          </div>
        )}
        
        {status === 'denied' && (
          <div className="py-4 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Location Blocked</h3>
            <p className="text-red-600 mt-2 text-sm font-medium">Please allow location access in your browser settings to verify your presence.</p>
            <button onClick={() => setStatus('idle')} className="mt-6 w-full bg-white text-gray-900 border border-gray-200 font-bold py-3 rounded-xl hover:bg-gray-50 transition-all">Go Back</button>
          </div>
        )}
      </div>
      
      <p className="text-center text-xs font-semibold text-gray-400 mt-8">
        Make sure you are physically inside the lecture hall before checking in.
      </p>
    </div>
  );
}