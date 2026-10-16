'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CheckCircle, AlertTriangle, Loader2, Navigation, User, WifiOff,
  ShieldCheck, Hand, ArrowRight, RefreshCw, Star, Signal
} from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { generateDeviceFingerprint } from '@/utils/deviceFingerprint';

interface Telemetry { lat: number; lng: number; alt: number | null; acc: number; timestamp: number; }
interface Props { sessionId: string; }

type Status =
  | 'idle' | 'checking' | 'needs_setup' | 'ready'
  | 'locating' | 'verifying' | 'success' | 'denied' | 'failed'
  | 'offline-queued' | 'syncing' | 'rating' | 'rated';

const RATING_TAGS = [
  'Clear Audio',
  'Well Explained',
  'Too Fast',
  'Too Slow',
  'Great Examples',
  'Confusing',
];

const GPS_BROWSER_TIMEOUT_MS = 20000;
const GPS_OVERALL_TIMEOUT_MS = 25000;
const GPS_MIN_PINGS_TO_SEND = 1;
const SEND_INTERVAL_MS = 4000;
const FINGERPRINT_WAIT_MS = 6000;

function getMeme(minutesLate: number): { title: string; sub: string; emoji: string } {
  if (minutesLate <= 2) return { title: 'Early Bird', sub: "Lecturer hasn't even opened their slides.", emoji: '🐦' };
  if (minutesLate <= 10) return { title: 'On Time', sub: 'Solid. Very solid.', emoji: '✅' };
  if (minutesLate <= 25) return { title: 'Fashionably Late', sub: 'We see you.', emoji: '🚶' };
  if (minutesLate <= 45) return { title: 'Living on the Edge', sub: 'You made it. Barely.', emoji: '😬' };
  return { title: 'The Prodigal Student', sub: "You came. That's what matters.", emoji: '🏃' };
}

export default function StudentCheckIn({ sessionId }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);

  const [sessionCreatedAt, setSessionCreatedAt] = useState<string | null>(null);

  const [ratingStars, setRatingStars] = useState(0);
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const [verifiedAt, setVerifiedAt] = useState<number | null>(null);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);

  const prewarmBufferRef = useRef<Telemetry[]>([]);
  const prewarmWatchIdRef = useRef<number | null>(null);
  const fingerprintRef = useRef<string | null>(null);

  const triggerSuccessVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  // Pre-warm GPS on page load
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        prewarmBufferRef.current.push({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude,
          acc: position.coords.accuracy,
          timestamp: position.timestamp
        });
        if (prewarmBufferRef.current.length > 30) {
          prewarmBufferRef.current = prewarmBufferRef.current.slice(-30);
        }
      },
      () => {
        // Silent — best-effort
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );

    prewarmWatchIdRef.current = id;

    return () => {
      if (prewarmWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(prewarmWatchIdRef.current);
      }
    };
  }, []);

  // Pre-warm device fingerprint (generate once, cache in ref)
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        console.log('[CampusCheck] Generating device fingerprint...');
        const fp = await generateDeviceFingerprint();
        console.log('[CampusCheck] Fingerprint generated:', fp);
        if (!cancelled) fingerprintRef.current = fp.hash;
      } catch (err) {
        console.error('[CampusCheck] Fingerprint generation failed:', err);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  // Fetch session metadata (for memes)
  useEffect(() => {
    let cancelled = false;
    const fetchMeta = async () => {
      try {
        const res = await fetch(`/api/dashboard-data?sessionId=${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.createdAt) setSessionCreatedAt(data.createdAt);
      } catch {
        // Non-fatal
      }
    };
    const id = setTimeout(() => { fetchMeta(); }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [sessionId]);

  const syncOfflineQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    if (queue.length === 0) return;
    setStatus('syncing');
    const remainingQueue: typeof queue = [];
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
            deviceFingerprint: item.fingerprint,
          })
        });
        if (res.ok || res.status === 409) successCount++;
        else remainingQueue.push(item);
      } catch {
        remainingQueue.push(item);
      }
    }
    localStorage.setItem('attendance_offline_queue', JSON.stringify(remainingQueue));
    if (successCount > 0 && remainingQueue.length === 0) {
      triggerSuccessVibration();
      setStatus('success');
    } else if (remainingQueue.length > 0) {
      setStatus('offline-queued');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', syncOfflineQueue);
    const id = setTimeout(() => { syncOfflineQueue(); }, 0);
    return () => {
      window.removeEventListener('online', syncOfflineQueue);
      clearTimeout(id);
    };
  }, [syncOfflineQueue]);

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => setStatus('rating'), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const checkStudentStatus = async () => {
    if (matricNumber.length < 5) return;
    setStatus('checking');

    try {
      const res = await fetch('/api/webauthn/auth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });

      if (res.status === 404) setStatus('needs_setup');
      else if (res.ok) setStatus('ready');
      else throw new Error("Failed to verify ledger.");
    } catch {
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

      const genRes = await fetch('/api/webauthn/register/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });

      const options = await genRes.json();
      if (!genRes.ok || options.error) {
        throw new Error(options.error || "Server rejected registration.");
      }

      const attResp = await startRegistration(options);

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: attResp })
      });
      const verifyResult = await verifyRes.json();

      if (verifyResult.verified) {
        localStorage.setItem('campuscheck_device_anchor', matricNumber);
        setStatus('ready');
      } else {
        throw new Error("Hardware binding failed.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to register your biometric device.";
      setErrorMessage(msg);
      setStatus('failed');
    }
  };

  const sendPayloadToVercel = useCallback(async (gpsTelemetry: Telemetry[]) => {
    try {
      // Fingerprint may not be ready yet — wait for it (max 6s)
      let fingerprint = fingerprintRef.current;
      if (!fingerprint) {
        const start = Date.now();
        while (!fingerprint && Date.now() - start < FINGERPRINT_WAIT_MS) {
          await new Promise(r => setTimeout(r, 100));
          fingerprint = fingerprintRef.current;
        }
      }
      console.log('[CampusCheck] Fingerprint being sent:', fingerprint);

      const response = await fetch('/api/verify-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          matricNumber,
          telemetry: gpsTelemetry,
          deviceFingerprint: fingerprint || 'unknown',
        })
      });
      const result = await response.json();

      if ((response.ok && result.status === 'verified') || response.status === 409) {
        triggerSuccessVibration();
        setVerifiedAt(Date.now());
        setStatus('success');
      } else if (result.status === 'flagged' || response.status === 403) {
        setErrorMessage(result.message || "Verification failed.");
        setStatus('failed');
      } else {
        setErrorMessage(result.message || "Verification failed.");
        setStatus('failed');
      }
    } catch (error) {
      const isNetwork = !navigator.onLine ||
        (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')));
      if (isNetwork) {
        const existing = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
        existing.push({
          session: sessionId,
          matric: matricNumber,
          telemetry: gpsTelemetry,
          fingerprint: fingerprintRef.current,
          timestamp: Date.now(),
        });
        localStorage.setItem('attendance_offline_queue', JSON.stringify(existing));
        setStatus('offline-queued');
      } else {
        setErrorMessage("Server connection lost.");
        setStatus('failed');
      }
    }
  }, [sessionId, matricNumber]);

  const executeFinalCheckIn = async () => {
    setStatus('locating');
    setLiveAccuracy(null);

    try {
      const genRes = await fetch('/api/webauthn/auth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      const options = await genRes.json();
      if (options.error) throw new Error(`Generate Error: ${options.error}`);

      const asseResp = await startAuthentication(options);

      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: asseResp })
      });
      const verifyResult = await verifyRes.json();

      if (verifyResult.error) throw new Error(`Verify Error: ${verifyResult.error}`);
      if (!verifyResult.verified) throw new Error("Biometric signature did not match.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown Auth Error occurred.";
      setErrorMessage(msg);
      setStatus('failed');
      return;
    }

    if (!navigator.geolocation) {
      setErrorMessage("Browser doesn't support location.");
      setStatus('failed');
      return;
    }

    const pings: Telemetry[] = [...prewarmBufferRef.current];
    let bestAcc = pings.reduce((min, p) => Math.min(min, p.acc), 9999);
    if (pings.length > 0) setLiveAccuracy(Math.round(bestAcc));

    let watchId = 0;
    let didFinish = false;
    let sentAny = false;

    const finishWith = (finalPings: Telemetry[]) => {
      if (didFinish) return;
      didFinish = true;
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (finalPings.length >= GPS_MIN_PINGS_TO_SEND) {
        sendPayloadToVercel(finalPings);
      } else {
        setErrorMessage("Couldn't get any location data. Pull down your menu and turn on Location/GPS, then try again.");
        setStatus('failed');
      }
    };

    if (pings.length >= 1) {
      sentAny = true;
      sendPayloadToVercel(pings);
    }

    const overallTimeoutId = setTimeout(() => {
      if (!sentAny && pings.length === 0) {
        finishWith(pings);
      } else {
        didFinish = true;
        if (watchId) navigator.geolocation.clearWatch(watchId);
      }
    }, GPS_OVERALL_TIMEOUT_MS);

    let lastSendTs = Date.now();

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const acc = position.coords.accuracy;
        if (acc < bestAcc) bestAcc = acc;
        setLiveAccuracy(Math.round(bestAcc));

        pings.push({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude,
          acc: position.coords.accuracy,
          timestamp: position.timestamp
        });

        const now = Date.now();
        if (now - lastSendTs >= SEND_INTERVAL_MS && !didFinish) {
          lastSendTs = now;
          sentAny = true;
          sendPayloadToVercel(pings);
        }
      },
      (error) => {
        clearTimeout(overallTimeoutId);
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (didFinish || sentAny) return;
        didFinish = true;

        if (error.code === 1) {
          setStatus('denied');
        } else {
          setErrorMessage(`GPS error (Code ${error.code}). Move near a window, or turn Location off and back on, then try again.`);
          setStatus('failed');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_BROWSER_TIMEOUT_MS }
    );
  };

  const requestAppeal = async () => {
    setIsAppealing(true);
    try {
      const response = await fetch('/api/request-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, matricNumber })
      });
      if (response.ok) {
        alert("Appeal sent! Please look at the lecturer for visual confirmation.");
        setStatus('idle');
      } else {
        alert("Failed to send appeal. Check network.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setIsAppealing(false);
    }
  };

  const toggleTag = (tag: string) => {
    setRatingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const submitRating = async (skip: boolean) => {
    setIsSubmittingRating(true);
    try {
      if (!skip) {
        await fetch('/api/rate-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, rating: ratingStars, tags: ratingTags })
        });
      }
    } catch {
      // Silent fail
    } finally {
      setIsSubmittingRating(false);
      setStatus('rated');
    }
  };

  const memeData = useMemo(() => {
    if (!sessionCreatedAt || verifiedAt === null) {
      return { minutesLate: 0, meme: getMeme(0) };
    }
    const start = new Date(sessionCreatedAt).getTime();
    const minutesLate = Math.max(0, Math.floor((verifiedAt - start) / 60000));
    return { minutesLate, meme: getMeme(minutesLate) };
  }, [sessionCreatedAt, verifiedAt]);

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
            <button
              onClick={registerDevice}
              className="w-full mt-4 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
            >
              Scan Biometrics
            </button>
            <button
              onClick={() => setStatus('idle')}
              className="w-full text-gray-500 font-bold py-3 hover:text-gray-800 transition-all text-sm"
            >
              Cancel
            </button>
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
            <button
              onClick={executeFinalCheckIn}
              className="w-full mt-4 bg-gray-900 text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
            >
              <Navigation size={20} /> Submit Attendance
            </button>
            <button
              onClick={() => setStatus('idle')}
              className="w-full text-gray-500 font-bold py-3 hover:text-gray-800 transition-all text-sm"
            >
              Not you? Switch account
            </button>
          </div>
        )}

        {(status === 'checking' || status === 'locating' || status === 'verifying' || status === 'syncing') && (
          <div className="py-8 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin mb-4" />
            <p className="text-gray-700 font-bold text-center">
              {status === 'checking' ? "Verifying ledger..."
                : status === 'locating' ? "Sending your location..."
                : status === 'syncing' ? "Syncing offline data..."
                : "Verifying coordinates..."}
            </p>
            {liveAccuracy !== null && (status === 'locating' || status === 'verifying') && (
              <div className="flex items-center gap-2 mt-3 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <Signal size={14} className="text-[#2563EB]" />
                <span className="text-xs font-bold text-[#2563EB]">±{liveAccuracy}m accuracy</span>
              </div>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900">Verified!</h3>
            <p className="text-green-700 font-bold mt-2 bg-green-50 px-4 py-2 rounded-xl inline-block uppercase tracking-wider text-sm border border-green-100">
              {matricNumber}
            </p>
            <p className="text-gray-500 mt-4 text-sm font-medium">Attendance recorded. Hang tight...</p>
          </div>
        )}

        {status === 'rating' && (
          <div className="py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-linear-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-5 text-center mb-6">
              <p className="text-4xl mb-2">{memeData.meme.emoji}</p>
              <h3 className="text-xl font-extrabold text-blue-900">{memeData.meme.title}</h3>
              <p className="text-sm text-blue-700 font-medium mt-1">{memeData.meme.sub}</p>
              {sessionCreatedAt && (
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-3">
                  {memeData.minutesLate === 0 ? "Right on time" : `${memeData.minutesLate} min after start`}
                </p>
              )}
            </div>

            <div className="text-center">
              <h4 className="font-extrabold text-gray-900 text-lg">How was this lecture?</h4>
              <p className="text-xs text-gray-500 font-medium mt-1">Anonymous • 5 seconds • Helps faculty improve</p>

              <div className="flex justify-center gap-2 mt-5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingStars(star)}
                    className="transition-transform active:scale-90"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      size={36}
                      className={star <= ratingStars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>

              {ratingStars > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-5 animate-in fade-in duration-300">
                  {RATING_TAGS.map((tag) => {
                    const active = ratingTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          active
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => submitRating(true)}
                  disabled={isSubmittingRating}
                  className="flex-1 bg-white text-gray-600 border border-gray-200 font-bold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  onClick={() => submitRating(false)}
                  disabled={isSubmittingRating || ratingStars === 0}
                  className="flex-1 bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingRating ? <Loader2 size={16} className="animate-spin" /> : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'rated' && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Thanks for the feedback!</h3>
            <p className="text-gray-500 mt-2 text-sm font-medium">You may close this page.</p>
          </div>
        )}

        {status === 'offline-queued' && (
          <div className="py-6 bg-blue-50 rounded-2xl border border-blue-100 px-4 text-center">
            <WifiOff className="w-16 h-16 text-[#2563EB] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900">Saved Offline</h3>
            <p className="text-blue-700 mt-2 text-sm font-medium leading-relaxed">
              Network dropped, but GPS secured. Keep this tab open. It will auto-submit when internet returns.
            </p>
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
              {!errorMessage.includes("out of bounds") && (
                <button
                  onClick={executeFinalCheckIn}
                  className="w-full flex justify-center items-center gap-2 bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all shadow-md"
                >
                  <RefreshCw size={18} /> Try Again
                </button>
              )}

              <button
                onClick={() => setStatus('idle')}
                className="w-full bg-white text-gray-900 border border-gray-200 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              >
                Start Over Completely
              </button>

              {!errorMessage.includes("out of bounds") && (
                <button
                  onClick={requestAppeal}
                  disabled={isAppealing}
                  className="w-full flex justify-center items-center gap-2 bg-orange-50 text-orange-800 font-bold py-3.5 rounded-xl hover:bg-orange-100 disabled:opacity-50 transition-all border border-orange-100 mt-4"
                >
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
            <p className="text-red-600 mt-2 text-sm font-medium">
              Please allow location access in your browser settings to verify your presence.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-6 w-full bg-white text-gray-900 border border-gray-200 font-bold py-3 rounded-xl hover:bg-gray-50 transition-all"
            >
              Go Back
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 text-center space-y-4">
        <p className="text-xs font-semibold text-gray-400">
          Make sure you are physically inside the lecture hall before checking in.
        </p>
      </div>
    </div>
  );
}