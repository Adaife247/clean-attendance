'use client';
import { useState, useEffect } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Loader2, Navigation, User, WifiOff, RefreshCcw, ShieldCheck } from 'lucide-react';

interface Telemetry {
  lat: number;
  lng: number;
  alt: number | null;
  acc: number;
  timestamp: number;
}

interface Props {
  sessionId: string;
}

// --- HARDWARE CANVAS FINGERPRINT ENGINE ---
// Forces physical GPU pixel rasterization to bypass Incognito software spoofing
const generateCanvasFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'canvas-not-supported';

    // Set complex alpha blending, font hierarchies, and geometry paths
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial', 'Noto Color Emoji', sans-serif";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("CampusCheck Security Matrix ❤️", 2, 10);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("CampusCheck Security Matrix ❤️", 4, 12);

    // Render overlapping geometry with vector shadow paths
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0, 0, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(150, 25, 15, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    const dataUrl = canvas.toDataURL();
    
    // Generate an immutable geometric hash code from the raw data URL stream
    let hash = 0;
    if (dataUrl.length === 0) return 'empty-raster';
    for (let i = 0; i < dataUrl.length; i++) {
      const char = dataUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; 
    }
    return 'HW-' + Math.abs(hash).toString(16).toUpperCase();
  } catch (e) {
    return 'fallback-id-' + Math.random().toString(36).substring(2, 9);
  }
};

export default function StudentCheckIn({ sessionId }: Props) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'denied' | 'failed' | 'offline-queued' | 'syncing'>('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const [matricNumber, setMatricNumber] = useState('');

  // --- THE OFFLINE SYNC ENGINE ---
  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    if (queue.length === 0) return;

    setStatus('syncing');
    const remainingQueue = [];
    let successCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch('/api/verify-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId: item.session, 
            matricNumber: item.matric, 
            telemetry: item.telemetry,
            deviceHash: item.deviceHash 
          })
        });
        
        if (res.ok || res.status === 409) {
          successCount++;
        } else {
          remainingQueue.push(item);
        }
      } catch (e) {
        remainingQueue.push(item); 
      }
    }

    localStorage.setItem('attendance_offline_queue', JSON.stringify(remainingQueue));

    if (successCount > 0 && remainingQueue.length === 0) {
      setStatus('success');
    } else if (remainingQueue.length > 0) {
      setStatus('offline-queued');
    }
  };

  useEffect(() => {
    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue(); 
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, []);

  const queueOfflinePayload = (telemetry: Telemetry[]) => {
    const existing = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    existing.push({ 
      session: sessionId, 
      matric: matricNumber, 
      telemetry, 
      deviceHash: generateCanvasFingerprint(), 
      timestamp: Date.now() 
    });
    localStorage.setItem('attendance_offline_queue', JSON.stringify(existing));
    setStatus('offline-queued');
  };

  // --- THE TRANSMISSION MATRIX ---
  const sendPayloadToVercel = async (gpsTelemetry: Telemetry[]) => {
    setStatus('verifying');
    try {
      const response = await fetch('/api/verify-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          matricNumber, 
          telemetry: gpsTelemetry,
          deviceHash: generateCanvasFingerprint() 
        })
      });
      
      const result = await response.json();
      
      if ((response.ok && result.status === 'verified') || response.status === 409) {
        setStatus('success');
      } else if (result.status === 'flagged') {
        setErrorMessage("Location configuration anomaly detected. Please see the lecturer.");
        setStatus('failed');
      } else {
        setErrorMessage(result.message || "Verification parameters rejected. See lecturer.");
        setStatus('failed');
      }
    } catch (error: any) {
      if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        queueOfflinePayload(gpsTelemetry);
      } else {
        setErrorMessage("Server telemetry connection lost. Please try again.");
        setStatus('failed');
      }
    }
  };

  const startCheckIn = () => {
    if (matricNumber.length < 5) return;
    setStatus('locating');

    if (!navigator.geolocation) {
      setErrorMessage("Your native browser interface doesn't support geolocation telemetry.");
      setStatus('failed');
      return;
    }

    let pings: Telemetry[] = [];
    let watchId: number;
    
    const timeoutId = setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (pings.length > 0) {
        sendPayloadToVercel(pings);
      } else {
        setErrorMessage("Satellite coordinate lock could not be secured within the structural limits.");
        setStatus('failed');
      }
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        pings.push({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude,
          acc: position.coords.accuracy,
          timestamp: position.timestamp
        });

        if (pings.length >= 3) {
          clearTimeout(timeoutId);
          navigator.geolocation.clearWatch(watchId);
          sendPayloadToVercel(pings);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (error.code === 1) {
          setStatus('denied');
        } else {
          setErrorMessage("Failed to grab physical coordinates. Ensure your device geolocation toggle is active.");
          setStatus('failed');
        }
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
    );
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
              <p className="text-gray-500 mt-2 text-sm font-medium">Please confirm your physical presence inside the lecture hall.</p>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400" />
              </div>
              <input 
                type="text" 
                placeholder="Matric Number (e.g. CSC/2021/001)"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium"
              />
            </div>
            <button 
              onClick={startCheckIn} 
              disabled={matricNumber.length < 5}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Navigation size={20} className="text-gray-300" /> Confirm Attendance
            </button>
          </div>
        )}

        {(status === 'locating' || status === 'verifying') && (
          <div className="py-6 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-gray-700 font-bold animate-pulse">
              {status === 'locating' ? "Acquiring structural satellite lock..." : "Verifying biometric coordinates..."}
            </p>
            <p className="text-xs text-gray-400 mt-2 font-medium">Keep your browser instance active</p>
          </div>
        )}

        {status === 'syncing' && (
          <div className="py-6 flex flex-col items-center bg-blue-50 rounded-2xl border border-blue-100">
            <RefreshCcw className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-blue-900 font-bold">Network Architecture Restored</p>
            <p className="text-blue-700 mt-1 text-sm font-medium">Syncing telemetry data to cloud server...</p>
          </div>
        )}

        {status === 'offline-queued' && (
          <div className="py-6 bg-blue-50 rounded-2xl border border-blue-100 px-4">
            <WifiOff className="w-16 h-16 text-[#2563EB] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900">Telemetry Saved Offline</h3>
            <p className="text-blue-700 mt-2 text-sm font-medium leading-relaxed">
              Network interfaces dropped, but physical coordinate telemetry and hardware tags were secured. Keep this window open. The platform will force submission upon reconnect.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 bg-green-50 rounded-2xl border border-green-100">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-900">Attendance Verified</h3>
            <p className="text-green-700 mt-1 text-sm font-medium">Your localized footprint has been logged into the ledger.</p>
          </div>
        )}

        {status === 'denied' && (
          <div className="py-6 bg-red-50 rounded-2xl border border-red-100 px-4">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-900 leading-tight">Location Privileges Required</h3>
            <p className="text-red-700 mt-2 text-sm font-medium">Geofence validation requires operational coordinate access in your browser.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="py-6 bg-orange-50 rounded-2xl border border-orange-100 px-4">
            <AlertTriangle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-orange-900">Verification Rejected</h3>
            <p className="text-orange-700 mt-2 text-sm font-medium">{errorMessage}</p>
            <button 
              onClick={() => setStatus('idle')} 
              className="mt-6 w-full bg-white text-gray-900 border border-gray-200 font-bold py-3 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm"
            >
              Try Again
            </button>
          </div>
        )}
        
        <p className="text-center text-xs font-semibold text-gray-400 mt-8">
          Secured by CampusCheck Zero-Trust Architecture
        </p>
      </div>
    </div>
  );
}