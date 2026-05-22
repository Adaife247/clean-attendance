'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, ShieldCheck, CheckCircle, AlertTriangle, Loader2, Navigation, Bug } from 'lucide-react';

// Simplified, stable device fingerprint for mobile
const generateDeviceFingerprint = (): string => {
  try {
    const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;
    const cores = navigator.hardwareConcurrency || 'unknown';
    const memory = (navigator as any).deviceMemory || 'unknown';
    const ua = navigator.userAgent.replace(/[\d\.]+/g, 'X'); // strip version numbers
    
    const fingerprint = `${screen}|${timezone}|${language}|${platform}|${cores}|${memory}|${ua}`;
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  } catch (e) {
    return 'fallback-device';
  }
};

function StudentCheckIn() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [matricNumber, setMatricNumber] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'flagged' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [debugHash, setDebugHash] = useState<string>(''); // visible debug

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage("Invalid link. Please use the exact link provided by your lecturer.");
    } else {
      // Generate and show fingerprint for debugging
      const hash = generateDeviceFingerprint();
      setDebugHash(hash);
    }
  }, [sessionId]);

  const gatherTelemetry = async () => {
    const pings: any[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
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
      setMessage("Acquiring satellite lock...");
      
      const telemetry = await gatherTelemetry();
      const deviceHash = generateDeviceFingerprint();
      
      // CLIENT-SIDE BACKUP: Check localStorage for this session
      const storageKey = `attendance_device_${sessionId}`;
      const storedMatric = localStorage.getItem(storageKey);
      if (storedMatric && storedMatric !== matricNumber.toUpperCase().trim()) {
        setStatus('error');
        setMessage(`❌ Device already used for ${storedMatric}. Cannot check in as ${matricNumber}.`);
        return;
      }

      setStatus('verifying');
      setMessage("Running verification...");

      const response = await fetch('/api/verify-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          matricNumber: matricNumber.toUpperCase().trim(),
          telemetry,
          deviceHash
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === 'verified') {
          // Store in localStorage that this device checked in with this matric
          localStorage.setItem(storageKey, matricNumber.toUpperCase().trim());
          setStatus('success');
        } else {
          setStatus('flagged');
        }
        setMessage(data.message);
        if (data.distance) setDistance(data.distance);
      } else {
        setStatus('error');
        setMessage(data.message || "Verification failed.");
      }

    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || "An unexpected error occurred.");
    }
  };

  // UI with debug info at bottom
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
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-green-100 max-w-sm w-full">
          <CheckCircle className="text-green-600 mx-auto mb-4" size={48} />
          <h1 className="text-2xl font-bold">Verified!</h1>
          <p className="text-green-700 mt-2 font-bold">{matricNumber}</p>
          <p className="text-xs text-gray-400 mt-4 break-all">Debug: {debugHash}</p>
        </div>
      </div>
    );
  }

  if (status === 'flagged') {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-red-100 max-w-sm w-full">
          <AlertTriangle className="text-red-600 mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold">Verification Failed</h1>
          <p className="text-red-600 mt-2">{message}</p>
          <button onClick={() => setStatus('idle')} className="mt-4 bg-gray-900 text-white px-6 py-2 rounded-xl">Try Again</button>
          <p className="text-xs text-gray-400 mt-4 break-all">Debug: {debugHash}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <div className="text-center mb-4">
          <ShieldCheck className="text-[#2563EB] mx-auto mb-2" size={40} />
          <h1 className="text-2xl font-bold">CampusCheck</h1>
        </div>

        {status === 'error' && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl">{message}</div>
        )}

        <input
          type="text"
          placeholder="Matric Number"
          value={matricNumber}
          onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
          className="w-full border rounded-xl p-3 mb-4"
          disabled={status === 'locating' || status === 'verifying'}
        />

        <button
          onClick={handleCheckIn}
          disabled={status !== 'idle' || !matricNumber.trim()}
          className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {status === 'locating' ? 'Locating...' : status === 'verifying' ? 'Verifying...' : 'Check In'}
        </button>

        {/* DEBUG INFO - Visible on mobile */}
        <div className="mt-6 pt-4 border-t text-center text-xs text-gray-400 break-all">
          <Bug size={14} className="inline mr-1" /> Device ID: {debugHash || 'loading...'}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>}>
      <StudentCheckIn />
    </Suspense>
  );
}