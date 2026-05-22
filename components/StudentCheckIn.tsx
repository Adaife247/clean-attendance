'use client';
import { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle, AlertTriangle, Loader2, Navigation, User, WifiOff, RefreshCcw, ShieldCheck, Camera } from 'lucide-react';

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

// --- CLIENT-SIDE COMPRESSOR (Saves Database Limits) ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Compress to 60% quality JPEG (turns 5MB into ~30KB)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        resolve(compressedBase64);
      };
      img.onerror = (error) => reject(error);
    };
  });
};

export default function StudentCheckIn({ sessionId }: Props) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'denied' | 'failed' | 'offline-queued' | 'syncing'>('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- THE SYNC ENGINE ---
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
            photoBase64: item.photoBase64 
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

  const queueOfflinePayload = (telemetry: Telemetry[], photoBase64: string) => {
    const existing = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    existing.push({ 
      session: sessionId, 
      matric: matricNumber, 
      telemetry, 
      photoBase64,
      timestamp: Date.now() 
    });
    localStorage.setItem('attendance_offline_queue', JSON.stringify(existing));
    setStatus('offline-queued');
  };

  // --- THE CHECK-IN ENGINE ---
  const sendPayloadToVercel = async (gpsTelemetry: Telemetry[], photoBase64: string) => {
    setStatus('verifying');
    try {
      const response = await fetch('/api/verify-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          matricNumber, 
          telemetry: gpsTelemetry,
          photoBase64
        })
      });
      
      const result = await response.json();
      
      if ((response.ok && result.status === 'verified') || response.status === 409) {
        setStatus('success');
      } else if (result.status === 'flagged') {
        setErrorMessage("Location anomaly detected. Please see the lecturer.");
        setStatus('failed');
      } else {
        setErrorMessage(result.message || "Verification failed. See lecturer.");
        setStatus('failed');
      }
    } catch (error: any) {
      if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        queueOfflinePayload(gpsTelemetry, photoBase64);
      } else {
        setErrorMessage("Server connection lost. Please try again.");
        setStatus('failed');
      }
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStatus('locating');
      try {
        const compressedPhoto = await compressImage(file);
        startGPSCheckIn(compressedPhoto);
      } catch (err) {
        setErrorMessage("Failed to process security photo.");
        setStatus('failed');
      }
    }
  };

  const startGPSCheckIn = (photoBase64: string) => {
    if (!navigator.geolocation) {
      setErrorMessage("Your browser doesn't support location services.");
      setStatus('failed');
      return;
    }

    let pings: Telemetry[] = [];
    let watchId: number;
    
    const timeoutId = setTimeout(() => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (pings.length > 0) {
        sendPayloadToVercel(pings, photoBase64);
      } else {
        setErrorMessage("We couldn't get a strong GPS lock indoors.");
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
          sendPayloadToVercel(pings, photoBase64);
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        if (error.code === 1) {
          setStatus('denied');
        } else {
          setErrorMessage("Failed to grab GPS. Ensure your location is turned on.");
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
              <p className="text-gray-500 mt-2 text-sm font-medium">Please confirm your physical presence.</p>
            </div>
            
            <div className="relative mb-4">
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

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3 text-left mb-2">
              <input 
                type="checkbox" 
                id="consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
              />
              <label htmlFor="consent" className="text-xs text-gray-600 font-medium leading-relaxed cursor-pointer">
                I consent to a live facial capture for identity verification. I understand this data is stored securely for auditing purposes and will be automatically deleted.
              </label>
            </div>

            <input 
              type="file" 
              accept="image/*" 
              capture="user" 
              ref={cameraInputRef} 
              onChange={handleCameraCapture} 
              className="hidden" 
            />

            <button 
              onClick={() => cameraInputRef.current?.click()} 
              disabled={matricNumber.length < 5 || !consentGiven}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera size={20} className="text-gray-300" /> Snap Selfie & Confirm
            </button>
          </div>
        )}

        {(status === 'locating' || status === 'verifying') && (
          <div className="py-6 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-gray-700 font-bold animate-pulse">
              {status === 'locating' ? "Securing coordinates & image..." : "Verifying payload..."}
            </p>
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
            <p className="text-blue-700 mt-2 text-sm font-medium leading-relaxed">
              Your network connection dropped, but your identity payload was secured. Leave this tab open. It will automatically submit when your internet returns.
            </p>
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