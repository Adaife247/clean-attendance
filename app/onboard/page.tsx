'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { startRegistration } from '@simplewebauthn/browser';
import { generateDeviceFingerprint } from '@/utils/deviceFingerprint';
import { ShieldCheck, Mail, User, ArrowRight, Loader2, CheckCircle, AlertTriangle, Fingerprint, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { safeStorage } from '@/utils/safe-storage';
import { STORAGE_KEYS } from '@/utils/constants';

type Step = 'matric' | 'email' | 'passkey' | 'success';

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('matric');

  const [matricNumber, setMatricNumber] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const fp = await generateDeviceFingerprint();
        setFingerprint(fp.hash);
        setDeviceId(fp.deviceId);
      } catch (err) {
        console.warn("Fingerprint generation failed", err);
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const existingAnchor = safeStorage.getString(STORAGE_KEYS.deviceAnchor);
    if (existingAnchor) {
      router.push('/student-hub');
    }
  }, [router]);

  const handleMatricCheck = async () => {
    const cleanMatric = matricNumber.toUpperCase().trim();
    if (cleanMatric.length < 5) {
      setError("Please enter a valid matric number.");
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('matric_number', cleanMatric)
        .limit(1);

      if (enrollError) throw enrollError;

      if (!enrollments || enrollments.length === 0) {
        setError("Your matric number isn't on any class roster yet. Ask your lecturer to upload your name.");
        setIsChecking(false);
        return;
      }

      const { data: existingDevice } = await supabase
        .from('user_devices')
        .select('credential_id')
        .eq('matric_number', cleanMatric)
        .maybeSingle();

      if (existingDevice) {
        setError("This matric already has a linked phone. If you changed phones, ask your lecturer to reset your device.");
        setIsChecking(false);
        return;
      }

      setMatricNumber(cleanMatric);
      setStep('email');
    } catch (err) {
      console.error(err);
      setError("Network error. Please check your connection.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      const res = await fetch('/api/onboard/save-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricNumber: matricNumber,
          recoveryEmail: recoveryEmail.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save your email.");
      }

      setStep('passkey');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save your email.");
    } finally {
      setIsChecking(false);
    }
  };

  const handlePasskeySetup = async () => {
    setIsRegistering(true);
    setError('');

    try {
      const genRes = await fetch('/api/webauthn/register/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber })
      });
      const options = await genRes.json();

      if (!genRes.ok || options.error) {
        throw new Error(options.message || options.error || "Server rejected registration.");
      }

      const hardenedOptions = {
        ...options,
        authenticatorSelection: {
          ...options.authenticatorSelection,
          authenticatorAttachment: 'platform' as const,
          userVerification: 'required' as const,
          residentKey: 'required' as const,
        },
        excludeCredentials: [],
      };

      let attResp;
      try {
        attResp = await startRegistration(hardenedOptions);
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError') {
          throw new Error("Setup was cancelled. Tap the button again and choose 'Allow' when prompted.");
        }
        if (name === 'NotSupportedError') {
          throw new Error("This browser doesn't support passkeys. Open the link in Chrome (Android) or Safari (iPhone).");
        }
        throw err;
      }

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricNumber,
          authResponse: attResp,
          deviceFingerprint: fingerprint || 'unknown',
          deviceId: deviceId || 'unknown'
        })
      });
      const verifyResult = await verifyRes.json();

      if (!verifyResult.verified) {
        throw new Error(verifyResult.error || "Hardware binding failed. Try again.");
      }

      safeStorage.setString(STORAGE_KEYS.deviceAnchor, matricNumber);
      safeStorage.setString(STORAGE_KEYS.studentMatric, matricNumber);

      setStep('success');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to set up biometrics.");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden transition-colors duration-300">

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">

        <div className="flex justify-between items-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-white dark:bg-gray-900 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
          <ThemeToggle />
        </div>

        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-[#2563EB] w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-5 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
            <ShieldCheck className="w-10 h-10 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-3xl"></div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Get Started</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 font-semibold text-base">Set up your secure attendance account</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-gray-300/30 dark:shadow-none border border-gray-100 dark:border-gray-800 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-6 transition-colors duration-300">

          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle size={16} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300 font-bold text-sm">{error}</p>
            </div>
          )}

          {step === 'matric' && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Step 1: Verify Identity</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your matric number to begin.</p>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400 dark:text-gray-500" /></div>
                <input
                  type="text"
                  placeholder="Matric Number (e.g., CSC/2021/001)"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleMatricCheck()}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase placeholder:text-sm placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <button
                onClick={handleMatricCheck}
                disabled={isChecking || matricNumber.length < 5}
                className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {isChecking ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                Continue
              </button>
            </div>
          )}

          {step === 'email' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Step 2: Recovery Email</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">If you change phones, we&apos;ll use this to recover your account.</p>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={18} className="text-gray-400 dark:text-gray-500" /></div>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <button
                onClick={handleEmailSubmit}
                disabled={isChecking || !recoveryEmail.includes('@')}
                className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {isChecking ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                Continue
              </button>
            </div>
          )}

          {step === 'passkey' && (
            <div className="space-y-5 text-center animate-in fade-in slide-in-from-right-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2 border border-blue-100 dark:border-blue-800">
                <Fingerprint size={32} className="text-[#2563EB] dark:text-blue-400" />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Step 3: Secure Your Device</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  We need to link this phone to <strong>{matricNumber}</strong> to prevent proxy attendance.
                  Your fingerprint never leaves your device.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300 font-medium text-left space-y-1.5">
                <p>📱 One-time setup — you won&apos;t do this again on this phone.</p>
                <p>🔒 Your biometrics are stored securely on your phone.</p>
                <p>🔄 Changing phones later? Use your recovery email.</p>
              </div>

              <button
                onClick={handlePasskeySetup}
                disabled={isRegistering}
                className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 mt-4"
              >
                {isRegistering ? <Loader2 size={20} className="animate-spin" /> : <Fingerprint size={20} />}
                {isRegistering ? "Setting up..." : "Scan Biometrics"}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-4 animate-in zoom-in-95">
              <CheckCircle size={64} className="text-green-500 dark:text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">You&apos;re all set!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-6">
                Your account is secure and your device is linked. You can now check in to any class with a single scan.
              </p>

              <button
                onClick={() => router.push('/student-hub')}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-4 rounded-2xl shadow-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
              >
                Go to Student Hub
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}