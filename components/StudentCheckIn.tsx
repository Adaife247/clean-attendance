// components/StudentCheckIn.tsx
'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle, AlertTriangle, Loader2, Navigation, User, WifiOff,
  ShieldCheck, Hand, ArrowRight, RefreshCw, Star, Signal, MapPin, ShieldAlert
} from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { generateDeviceFingerprint } from '@/utils/deviceFingerprint';
import { safeStorage } from '@/utils/safe-storage';
import { STORAGE_KEYS } from '@/utils/constants';
import { getStudentHeaders } from '@/utils/api-client';
import { logger } from '@/utils/logger';

interface Telemetry { lat: number; lng: number; alt: number | null; acc: number; timestamp: number; }
interface Props { sessionId: string; }

interface OfflineQueueItem {
  session: string;
  matric: string;
  telemetry: Telemetry[];
  fingerprint: string | null;
  verificationMethod: string;
  timestamp: number;
}

type Status =
  | 'idle' | 'checking' | 'needs_setup' | 'ready'
  | 'locating' | 'verifying' | 'success' | 'denied' | 'failed' | 'disqualified'
  | 'offline-queued' | 'syncing' | 'rating' | 'rated';

const RATING_TAGS = ['Clear Audio', 'Well Explained', 'Too Fast', 'Too Slow', 'Great Examples', 'Confusing'];
const GPS_BROWSER_TIMEOUT_MS = 20000;
const GPS_OVERALL_TIMEOUT_MS = 25000;
const GPS_MIN_WAIT_FOR_FIRST_PING_MS = 8000;
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

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|Snapchat|LinkedInApp|Pinterest|TikTok/i.test(ua);
}

export default function StudentCheckIn({ sessionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [isIosFallback, setIsIosFallback] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'other'>('other');
  const [inAppBrowser, setInAppBrowser] = useState(false);

  const prewarmBufferRef = useRef<Telemetry[]>([]);
  const prewarmWatchIdRef = useRef<number | null>(null);
  const fingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      const urlMatric = searchParams.get('matric');
      const savedMatric = safeStorage.getString(STORAGE_KEYS.studentMatric);

      if (urlMatric) {
        setMatricNumber(urlMatric.toUpperCase());
      } else if (savedMatric) {
        setMatricNumber(savedMatric.toUpperCase());
      }

      const ua = navigator.userAgent;
      if (/iPad|iPhone|iPod/.test(ua)) {
        setDeviceType('ios');
      } else if (/android/i.test(ua)) {
        setDeviceType('android');
      } else {
        setDeviceType('other');
      }

      if (isInAppBrowser()) {
        setInAppBrowser(true);
      }
    }, 0);

    return () => clearTimeout(id);
  }, [searchParams]);

  const triggerSuccessVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const isIosNonSafari = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isNotSafari = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIOS && isNotSafari;
  };

  const checkPermissionFromGesture = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus('granted'),
      (error) => {
        if (error.code === 1) setGpsStatus('denied');
        else setGpsStatus('granted');
      },
      { timeout: 8000, maximumAge: 0, enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (gpsStatus !== 'granted') return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        prewarmBufferRef.current.push({
          lat: position.coords.latitude, lng: position.coords.longitude,
          alt: position.coords.altitude, acc: position.coords.accuracy, timestamp: position.timestamp
        });
        if (prewarmBufferRef.current.length > 30) {
          prewarmBufferRef.current = prewarmBufferRef.current.slice(-30);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
    prewarmWatchIdRef.current = id;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        prewarmBufferRef.current.push({
          lat: position.coords.latitude, lng: position.coords.longitude,
          alt: position.coords.altitude, acc: position.coords.accuracy, timestamp: position.timestamp
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => { if (prewarmWatchIdRef.current !== null) navigator.geolocation.clearWatch(prewarmWatchIdRef.current); };
  }, [gpsStatus]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const fp = await generateDeviceFingerprint();
        if (!cancelled) fingerprintRef.current = fp.hash;
      } catch (err) {
        logger.warn('Fingerprint generation failed', err);
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(id); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchMeta = async () => {
      try {
        const token = safeStorage.getSessionString(STORAGE_KEYS.studentJwt);
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/dashboard-data?sessionId=${sessionId}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.createdAt) setSessionCreatedAt(data.createdAt);
      } catch (err) {
        logger.warn('Failed to fetch session metadata', err);
      }
    };
    const id = setTimeout(() => { fetchMeta(); }, 0);
    return () => { cancelled = true; clearTimeout(id); };
  }, [sessionId]);

  const syncOfflineQueue = useCallback(async () => {
    const queue = safeStorage.getJSON<OfflineQueueItem[]>(STORAGE_KEYS.offlineQueue) || [];
    if (queue.length === 0) return;
    setStatus('syncing');
    const remainingQueue: OfflineQueueItem[] = [];
    let successCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch('/api/verify-attendance', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: item.session,
            matricNumber: item.matric,
            telemetry: item.telemetry,
            deviceFingerprint: item.fingerprint,
            verificationMethod: item.verificationMethod,
            userAgent: navigator.userAgent
          })
        });
        if (res.ok || res.status === 409) successCount++;
        else remainingQueue.push(item);
      } catch (err) { 
        logger.warn('Offline sync failed for item', err);
        remainingQueue.push(item); 
      }
    }
    safeStorage.setJSON(STORAGE_KEYS.offlineQueue, remainingQueue);
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
    return () => { window.removeEventListener('online', syncOfflineQueue); clearTimeout(id); };
  }, [syncOfflineQueue]);

  const checkStudentStatus = async () => {
    if (matricNumber.length < 5) return;
    setStatus('checking');
    setErrorMessage('');
    try {
      const res = await fetch('/api/webauthn/auth/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      if (res.status === 404) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'NOT_ENROLLED') {
          setErrorMessage(data.message || "You are not on any class roster yet.");
          setStatus('failed');
          return;
        }
        setStatus('needs_setup');
      } else if (res.ok) {
        setStatus('ready');
      } else {
        throw new Error("Failed to verify ledger.");
      }
    } catch {
      setErrorMessage("Network error. Could not connect to the database.");
      setStatus('failed');
    }
  };

  const registerDevice = async () => {
    try {
      const existingAnchor = safeStorage.getString(STORAGE_KEYS.deviceAnchor);
      if (existingAnchor && existingAnchor !== matricNumber) {
        setErrorMessage(`This device is already bound to ${existingAnchor}. Ask your lecturer to reset your device if this is a mistake.`);
        setStatus('failed');
        return;
      }
      setStatus('locating');
      const genRes = await fetch('/api/webauthn/register/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      const options = await genRes.json();
      if (!genRes.ok || options.error) throw new Error(options.message || options.error || "Server rejected registration.");

      let attResp;
      try {
        attResp = await startRegistration(options);
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError') {
          throw new Error("Passkey setup was cancelled or timed out. Tap the button again and choose 'Allow' when prompted.");
        }
        if (name === 'InvalidStateError') {
          throw new Error("This phone already has a passkey for CampusCheck. Ask your lecturer to reset your device.");
        }
        if (name === 'NotSupportedError') {
          throw new Error("This browser doesn't support passkeys. Open the link in Chrome (Android) or Safari (iPhone).");
        }
        throw err;
      }

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber, authResponse: attResp })
      });
      const verifyResult = await verifyRes.json();

      if (verifyResult.verified) {
        safeStorage.setString(STORAGE_KEYS.deviceAnchor, matricNumber);
        setStatus('ready');
      } else {
        throw new Error("Hardware binding failed. Try again.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to register your biometric device.";
      setErrorMessage(msg);
      setStatus('failed');
    }
  };

  const sendPayloadToVercel = useCallback(async (gpsTelemetry: Telemetry[], verificationMethod: string) => {
    try {
      let fingerprint = fingerprintRef.current;
      if (!fingerprint) {
        const start = Date.now();
        while (!fingerprint && Date.now() - start < FINGERPRINT_WAIT_MS) {
          await new Promise(r => setTimeout(r, 100));
          fingerprint = fingerprintRef.current;
        }
      }

      const response = await fetch('/api/verify-attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          matricNumber,
          telemetry: gpsTelemetry,
          deviceFingerprint: fingerprint || 'unknown',
          verificationMethod,
          userAgent: navigator.userAgent
        })
      });
      const result = await response.json();

      if (result.status === 'verified' || response.status === 409) {
        triggerSuccessVibration();
        setVerifiedAt(Date.now());
        setStatus('success');
        safeStorage.setString(STORAGE_KEYS.studentMatric, matricNumber);

        const currentCount = parseInt(localStorage.getItem(STORAGE_KEYS.checkinCount) || '0', 10);
        localStorage.setItem(STORAGE_KEYS.checkinCount, String(currentCount + 1));
      } else {
        setErrorMessage(result.message || "Verification failed.");
        if (result.status === 'disqualified') {
          setStatus('disqualified');
        } else {
          setStatus('failed');
        }
      }
    } catch (error) {
      const isNetwork = !navigator.onLine || (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')));
      if (isNetwork) {
        const existing = safeStorage.getJSON<OfflineQueueItem[]>(STORAGE_KEYS.offlineQueue) || [];
        if (!existing.some(item => item.session === sessionId)) {
          existing.push({ session: sessionId, matric: matricNumber, telemetry: gpsTelemetry, fingerprint: fingerprintRef.current, verificationMethod, timestamp: Date.now() });
          safeStorage.setJSON(STORAGE_KEYS.offlineQueue, existing);
        }
        setStatus('offline-queued');
      } else {
        setErrorMessage("Connection lost. Check your internet and try again.");
        setStatus('failed');
      }
    }
  }, [sessionId, matricNumber]);

  const executeFinalCheckIn = async () => {
    setStatus('locating');
    setErrorMessage('');
    setLiveAccuracy(null);

    checkPermissionFromGesture();

    let verificationMethod = 'skipped';

    const skipWebAuthn = isIosNonSafari();
    if (skipWebAuthn) setIsIosFallback(true);

    if (!skipWebAuthn) {
      try {
        const genRes = await fetch('/api/webauthn/auth/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matricNumber })
        });
        if (genRes.status === 404) {
          verificationMethod = 'skipped';
        } else {
          const options = await genRes.json();
          if (options.error) throw new Error(options.message || options.error);
          const asseResp = await startAuthentication(options);
          const verifyRes = await fetch('/api/webauthn/auth/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricNumber, authResponse: asseResp })
          });
          const verifyResult = await verifyRes.json();
          
          if (verifyResult.verified) {
            verificationMethod = 'biometric';
            if (verifyResult.token) {
              safeStorage.setSessionString(STORAGE_KEYS.studentJwt, verifyResult.token);
            }
          } else {
            throw new Error("Biometric verification failed.");
          }
        }
      } catch (error) {
        console.warn("Biometric step failed, continuing with GPS only:", error);
        verificationMethod = 'skipped';
      }
    } else {
      verificationMethod = 'ios_web';
    }

    if (!navigator.geolocation) {
      setErrorMessage("This browser doesn't support location. Open the link in Chrome or Safari.");
      setStatus('failed');
      return;
    }

    const pings: Telemetry[] = [...prewarmBufferRef.current];
    let bestAcc = pings.reduce((min, p) => (p.acc > 0 ? Math.min(min, p.acc) : min), Infinity);
    if (Number.isFinite(bestAcc)) setLiveAccuracy(Math.round(bestAcc));

    let watchId = 0;
    let didFinish = false;
    let sentAny = false;

    const finishWith = (finalPings: Telemetry[]) => {
      if (didFinish) return;
      didFinish = true;
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (finalPings.length >= GPS_MIN_PINGS_TO_SEND) {
        sendPayloadToVercel(finalPings, verificationMethod);
      } else {
        setErrorMessage("Couldn't get any location data. Make sure Location is ON and you're near a window, then try again.");
        setStatus('failed');
      }
    };

    if (pings.length >= 1) {
      sentAny = true;
      sendPayloadToVercel([...pings], verificationMethod);
    }

    const overallTimeoutId = setTimeout(() => {
      if (!sentAny && pings.length === 0) finishWith(pings);
      else { didFinish = true; if (watchId) navigator.geolocation.clearWatch(watchId); }
    }, GPS_OVERALL_TIMEOUT_MS);

    const firstPingWaitId = setTimeout(() => {
      if (pings.length === 0 && !didFinish) {
        finishWith(pings);
      }
    }, GPS_MIN_WAIT_FOR_FIRST_PING_MS);

    let lastSendTs = Date.now();

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const acc = position.coords.accuracy;
        if (acc > 0 && acc < bestAcc) bestAcc = acc;
        if (Number.isFinite(bestAcc)) setLiveAccuracy(Math.round(bestAcc));
        pings.push({
          lat: position.coords.latitude, lng: position.coords.longitude,
          alt: position.coords.altitude, acc: position.coords.accuracy, timestamp: position.timestamp
        });

        const now = Date.now();
        if (now - lastSendTs >= SEND_INTERVAL_MS && !didFinish) {
          lastSendTs = now;
          sentAny = true;
          sendPayloadToVercel([...pings], verificationMethod);
        }
      },
      (error) => {
        clearTimeout(overallTimeoutId);
        clearTimeout(firstPingWaitId);
        if (watchId) navigator.geolocation.clearWatch(watchId);
        if (didFinish || sentAny) return;
        didFinish = true;
        if (error.code === 1) setStatus('denied');
        else {
          setErrorMessage(`GPS error (code ${error.code}). Turn Location off and back on, then try again.`);
          setStatus('failed');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_BROWSER_TIMEOUT_MS }
    );
  };

  const requestAppeal = async () => {
    setIsAppealing(true);
    setErrorMessage('');
    try {
      const headers = getStudentHeaders();
      const response = await fetch('/api/request-override', {
        method: 'POST', headers,
        body: JSON.stringify({ sessionId })
      });
      if (response.ok) {
        setErrorMessage("Appeal sent. Show this screen to your lecturer for visual confirmation.");
        setStatus('idle');
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data.message || data.error || "Failed to send appeal. Check your connection and try again.");
      }
    } catch {
      setErrorMessage("Network error. Check your connection and try again.");
    } finally {
      setIsAppealing(false);
    }
  };  const toggleTag = (tag: string) => {
    setRatingTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const submitRating = async (skip: boolean) => {
    setIsSubmittingRating(true);
    try {
      if (!skip) {
        const headers = getStudentHeaders();
        await fetch('/api/rate-session', {
          method: 'POST', headers,
          body: JSON.stringify({ sessionId, rating: ratingStars, tags: ratingTags })
        });
      }
    } catch (err) { 
      logger.warn('Rating submission failed', err);
    }
    finally {
      setIsSubmittingRating(false);
      router.push('/portal');
    }
  };

  const memeData = useMemo(() => {
    if (!sessionCreatedAt || verifiedAt === null) return { minutesLate: 0, meme: getMeme(0) };
    const start = new Date(sessionCreatedAt).getTime();
    const minutesLate = Math.max(0, Math.floor((verifiedAt - start) / 60000));
    return { minutesLate, meme: getMeme(minutesLate) };
  }, [sessionCreatedAt, verifiedAt]);

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 sm:p-8 relative overflow-y-auto max-h-[85vh] transition-colors duration-300">

        {inAppBrowser && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl animate-in slide-in-from-top-4 transition-colors">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 dark:text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-red-900 dark:text-red-400 text-sm">Open this link in your browser</h4>
                <p className="text-xs text-red-700 dark:text-red-300 font-medium mt-1 leading-relaxed">
                  You opened this link inside another app. Passkey setup does not work in in-app browsers.
                  Tap the menu (⋮) and choose <strong>Open in Chrome</strong> or <strong>Open in Safari</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {gpsStatus === 'denied' && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl animate-in slide-in-from-top-4 transition-colors">
            <div className="flex items-start gap-3">
              <MapPin className="text-red-600 dark:text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-red-900 dark:text-red-400 text-sm">Location is blocked</h4>
                <p className="text-xs text-red-700 dark:text-red-300 font-medium mt-1 mb-3">
                  Your browser is blocking location access. Follow these steps:
                </p>

                <div className="text-xs text-red-800 dark:text-red-200 space-y-1.5 bg-white/60 dark:bg-gray-900/50 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
                  {deviceType === 'ios' ? (
                    <>
                      <p className="font-bold text-[13px]">On iPhone / Safari:</p>
                      <p>1. Open iPhone <strong>Settings</strong>.</p>
                      <p>2. Scroll down and tap <strong>Safari</strong>.</p>
                      <p>3. Tap <strong>Location</strong> → <strong>Allow</strong>.</p>
                      <p>4. Return here and tap the button below.</p>
                    </>
                  ) : deviceType === 'android' ? (
                    <>
                      <p className="font-bold text-[13px]">On Android / Chrome:</p>
                      <p>1. Tap the <strong>lock icon</strong> next to the address.</p>
                      <p>2. Tap <strong>Permissions</strong>.</p>
                      <p>3. Set <strong>Location</strong> to <strong>Allow</strong>.</p>
                      <p>4. Refresh this page.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-[13px]">On your browser:</p>
                      <p>1. Click the <strong>lock icon</strong> next to the address.</p>
                      <p>2. Set <strong>Location</strong> to <strong>Allow</strong>.</p>
                      <p>3. Refresh this page.</p>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    setGpsStatus('prompt');
                    checkPermissionFromGesture();
                  }}
                  className="mt-3 w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-red-700 transition-all shadow-sm"
                >
                  I turned it on — check again
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {errorMessage && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start gap-2 animate-in fade-in">
                <CheckCircle size={16} className="text-[#2563EB] dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-800 dark:text-blue-300 font-bold text-sm">{errorMessage}</p>
              </div>
            )}
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white dark:focus-within:bg-gray-800 transition-all overflow-hidden">
              <div className="pl-4 pr-3 flex items-center justify-center text-gray-400 dark:text-gray-500"><User size={18} /></div>
              <input type="text" placeholder="Matric Number (e.g., CSC/2021/001)" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && checkStudentStatus()} className="w-full bg-transparent text-gray-900 dark:text-white font-bold py-4 pr-4 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm uppercase" />
            </div>
            <button onClick={checkStudentStatus} disabled={matricNumber.length < 5} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
              Continue <ArrowRight size={20} className="text-white/70" />
            </button>
          </div>
        )}

        {status === 'needs_setup' && (
          <div className="space-y-4 text-center animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800"><ShieldCheck size={32} className="text-[#2563EB] dark:text-blue-400" /></div>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Hardware Setup</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-3 text-sm font-medium leading-relaxed">We need to link this phone to <span className="font-bold text-gray-900 dark:text-white">{matricNumber}</span> to prevent proxy attendance.</p>
            <button onClick={registerDevice} className="w-full mt-4 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2">Scan Biometrics</button>
            <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="w-full text-gray-500 dark:text-gray-400 font-bold py-3 hover:text-gray-800 dark:hover:text-white transition-all text-sm">Cancel</button>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-4 text-center animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100 dark:border-green-800"><CheckCircle size={32} className="text-green-600 dark:text-green-500" /></div>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Identity Confirmed</h3>
            <p className="text-gray-900 dark:text-white font-black text-xl mt-1">{matricNumber}</p>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm font-medium leading-relaxed">Your device is linked. Make sure you are inside the lecture hall.</p>
            <button onClick={executeFinalCheckIn} className="w-full mt-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-lg py-4 rounded-xl shadow-md hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] transition-all flex justify-center items-center gap-2"><Navigation size={20} /> Submit Attendance</button>
            <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="w-full text-gray-500 dark:text-gray-400 font-bold py-3 hover:text-gray-800 dark:hover:text-white transition-all text-sm">Not you? Switch account</button>
          </div>
        )}

        {(status === 'checking' || status === 'locating' || status === 'verifying' || status === 'syncing') && (
          <div className="py-8 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-[#2563EB] dark:text-blue-400 animate-spin mb-4" />
            <p className="text-gray-700 dark:text-gray-300 font-bold text-center">
              {status === 'checking' ? "Verifying ledger..." : status === 'locating' ? "Getting your location..." : status === 'syncing' ? "Syncing offline data..." : "Verifying coordinates..."}
            </p>
            {liveAccuracy !== null && (status === 'locating' || status === 'verifying') && (
              <div className="flex items-center gap-2 mt-3 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800"><Signal size={14} className="text-[#2563EB] dark:text-blue-400" /><span className="text-xs font-bold text-[#2563EB] dark:text-blue-400">±{liveAccuracy}m accuracy</span></div>
            )}
          </div>
        )}        {status === 'success' && (
          <div className="py-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CheckCircle className="w-20 h-20 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Verified!</h3>
            <p className="text-green-700 dark:text-green-400 font-bold mt-2 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-xl inline-block uppercase tracking-wider text-sm border border-green-100 dark:border-green-800">{matricNumber}</p>
            <p className="text-gray-500 dark:text-gray-400 mt-4 text-sm font-medium">Attendance recorded.</p>
            {isIosFallback && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-2">Note: biometrics weren&apos;t used on this browser. Verified via GPS.</p>
            )}

            <div className="mt-8 space-y-3">
              <button onClick={() => setStatus('rating')} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3.5 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-md">
                Rate this Lecture
              </button>
              <button onClick={() => router.push('/portal')} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                Return to Portal
              </button>
            </div>
          </div>
        )}

        {status === 'rating' && (
          <div className="py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 text-center mb-6 transition-colors">
              <p className="text-4xl mb-2">{memeData.meme.emoji}</p>
              <h3 className="text-xl font-extrabold text-blue-900 dark:text-white">{memeData.meme.title}</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mt-1">{memeData.meme.sub}</p>
              {sessionCreatedAt && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mt-3">{memeData.minutesLate === 0 ? "Right on time" : `${memeData.minutesLate} min after start`}</p>
              )}
            </div>

            <div className="text-center">
              <h4 className="font-extrabold text-gray-900 dark:text-white text-lg">How was this lecture?</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">Anonymous • 5 seconds • Helps faculty improve</p>

              <div className="flex justify-center gap-2 mt-5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRatingStars(star)} className="transition-transform active:scale-90" aria-label={`Rate ${star} stars`}>
                    <Star size={36} className={star <= ratingStars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'} strokeWidth={1.5} />
                  </button>
                ))}
              </div>

              {ratingStars > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-5 animate-in fade-in duration-300">
                  {RATING_TAGS.map((tag) => {
                    const active = ratingTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}>{tag}</button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button onClick={() => submitRating(true)} disabled={isSubmittingRating} className="flex-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm disabled:opacity-50">Skip</button>
                <button onClick={() => submitRating(false)} disabled={isSubmittingRating || ratingStars === 0} className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmittingRating ? <Loader2 size={16} className="animate-spin" /> : 'Submit & View Shield'}
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'offline-queued' && (
          <div className="py-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 px-4 text-center transition-colors">
            <WifiOff className="w-16 h-16 text-[#2563EB] dark:text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900 dark:text-white">Saved Offline</h3>
            <p className="text-blue-700 dark:text-blue-300 mt-2 text-sm font-medium leading-relaxed">Network dropped, but GPS was captured. Keep this tab open. It will auto-submit when the internet returns.</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Verification Failed</h3>
            <p className="text-orange-700 dark:text-orange-300 mt-2 text-sm font-bold bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-800 transition-colors">
              {errorMessage}
            </p>
            <div className="mt-6 space-y-3">
              <button onClick={executeFinalCheckIn} className="w-full flex justify-center items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3.5 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] transition-all shadow-md"><RefreshCw size={18} /> Try Again</button>

              <button onClick={requestAppeal} disabled={isAppealing} className="w-full flex justify-center items-center gap-2 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 font-bold py-3.5 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/40 disabled:opacity-50 transition-all border border-orange-100 dark:border-orange-800">
                {isAppealing ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />} Raise Hand (I am in the hall)
              </button>

              <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">Start Over</button>
            </div>
          </div>
        )}

        {status === 'disqualified' && (
          <div className="py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ShieldAlert className="w-16 h-16 text-red-600 dark:text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Attempt Blocked</h3>
            <p className="text-red-700 dark:text-red-300 mt-2 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800 transition-colors">
              {errorMessage}
            </p>
            <div className="mt-6 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Show this screen to your lecturer to be verified manually.</p>
              <button onClick={requestAppeal} disabled={isAppealing} className="w-full flex justify-center items-center gap-2 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 font-bold py-3.5 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/40 disabled:opacity-50 transition-all border border-orange-100 dark:border-orange-800">
                {isAppealing ? <Loader2 size={18} className="animate-spin" /> : <Hand size={18} />} Raise Hand
              </button>
              <button onClick={() => router.push('/portal')} className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3.5 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-md">Return to Portal</button>
            </div>
          </div>
        )}

        {status === 'denied' && (
          <div className="py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Location Blocked</h3>
            <p className="text-red-600 dark:text-red-400 mt-2 text-sm font-medium">Allow location access for this site, then try again.</p>
            <button onClick={() => { checkPermissionFromGesture(); setStatus('idle'); }} className="mt-6 w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all">I turned it on — try again</button>
            <button onClick={() => setStatus('idle')} className="mt-3 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Go Back</button>
          </div>
        )}
      </div>

      <div className="mt-6 text-center space-y-4">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Make sure you are physically inside the lecture hall before checking in.</p>
      </div>
    </div>
  );
}