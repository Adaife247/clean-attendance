'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  ShieldCheck, Loader2, LogIn, Zap, Lock, Activity, 
  CheckCircle, XCircle, Fingerprint, MapPin, Upload, Bell, Sparkles, User
} from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

const StudentCheckInComponent = dynamic(() => import('../components/StudentCheckIn'), { ssr: false });

function CheckInWrapper() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [isNavigating, setIsNavigating] = useState(false);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans relative overflow-hidden transition-colors duration-300">
        
        {/* Ambient Background Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Announcement Bar */}
                <div className="bg-[#2563EB] text-white text-xs font-bold text-center py-2 px-4 tracking-wide flex items-center justify-center gap-2">
          <Sparkles size={14} className="text-blue-200" />
          <span>NEW: Secure biometric check-in is now live for all students. <a href="/onboard" className="underline hover:text-blue-100">Set up your account</a>.</span>
        </div>

        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-[#2563EB] w-8 h-8 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                <ShieldCheck className="text-white" size={18} strokeWidth={2.5} />
              </div>
              <span className="font-black text-gray-900 dark:text-white text-lg tracking-tight">CampusCheck</span>
            </div>
            
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href="/login" className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-2">
                Faculty Login
              </Link>
              <Link href="/student-hub" className="hidden sm:block bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98] transition-all">
                Student Hub
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 md:pt-32 md:pb-24 relative z-10 text-center flex flex-col items-center">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-[#2563EB] dark:text-blue-400 text-xs font-bold mb-8 animate-in fade-in slide-in-from-bottom-4">
            <ShieldCheck size={14} /> Built for NUC Compliance & Zero Proxy
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-6 animate-in fade-in slide-in-from-bottom-6">
            Secure, geofenced <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#2563EB] to-blue-400 dark:from-blue-400 dark:to-emerald-400">
              attendance tracking.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 font-medium max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8">
            No proxy. No manual roll calls. Just FaceID, Fingerprint, or PIN, plus GPS verification, and instant analytics for your lecture hall.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-10">
            <Link 
              href="/student-hub" 
              onClick={() => setIsNavigating(true)}
              className={`group relative w-full sm:w-auto flex items-center justify-center gap-2 py-4 px-8 rounded-2xl transition-all duration-300 overflow-hidden shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.4)] ${isNavigating ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#2563EB] hover:bg-blue-700'}`}
            >
              {isNavigating ? (
                <Loader2 size={20} className="text-white animate-spin" strokeWidth={3} />
              ) : (
                <LogIn size={20} className="text-white" strokeWidth={3} />
              )}
              <span className="font-black text-white text-lg tracking-wide">
                {isNavigating ? "Entering..." : "Enter Student Hub"}
              </span>
            </Link>

            <a 
              href="/onboard" 
              className="group w-full sm:w-auto flex items-center justify-center gap-2 py-4 px-8 rounded-2xl bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold text-lg hover:border-[#2563EB] dark:hover:border-blue-500 transition-all"
            >
              <Fingerprint size={20} className="text-[#2563EB] dark:text-blue-400" />
              Set Up Device
            </a>
          </div>

          {/* Trust Bar */}
          <div className="mt-16 pt-8 border-t border-gray-200/50 dark:border-gray-800/50 flex flex-wrap justify-center items-center gap-6 sm:gap-10 animate-in fade-in duration-1000">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              <CheckCircle size={16} className="text-emerald-500" /> NUC Compliant
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              <Lock size={16} className="text-blue-500" /> WebAuthn Secured
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              <MapPin size={16} className="text-red-500" /> Geofenced
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              <Activity size={16} className="text-purple-500" /> Live Sync
            </div>
          </div>
        </main>

        {/* Comparison Section (Before / After) */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
              Attendance is broken. <br />
              <span className="text-gray-400 dark:text-gray-500">Let&apos;s fix it.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-red-100 dark:border-red-900/30 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-900/10 rounded-bl-full pointer-events-none"></div>
              <h3 className="text-xl font-black text-red-600 dark:text-red-400 mb-6 flex items-center gap-2">
                <XCircle size={24} /> The Old Way
              </h3>
              <ul className="space-y-4">
                {[
                  "Attendance sheet is passed around the room.",
                  "Students sign for their friends who are absent.",
                  "Someone tears the sheet or spills water on it.",
                  "Lecturer has to manually count the signatures.",
                  "Zero data for NUC compliance."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600 dark:text-gray-400 font-medium text-sm">
                    <span className="text-red-400 mt-0.5">✕</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 relative overflow-hidden shadow-lg shadow-emerald-500/5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-bl-full pointer-events-none"></div>
              <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mb-6 flex items-center gap-2">
                <CheckCircle size={24} /> The CampusCheck Way
              </h3>
                            <ul className="space-y-4">
                {[
                  "Students scan their FaceID, Fingerprint, or PIN.",
                  "GPS ensures they are actually in the hall.",
                  "Attendance takes 30 seconds, not 15 minutes.",
                  "Data is instantly saved to the cloud.",
                  "Automatic NUC compliance reports."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-600 dark:text-gray-400 font-medium text-sm">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span> 
                    <span className="wrap-break-word min-w-0 flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

                {/* How It Works Section */}
        <section className="bg-white dark:bg-gray-900/50 border-y border-gray-200 dark:border-gray-800 py-24 relative z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
                How it works
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto">
                Two flows. One seamless system. Built for the speed of a Nigerian lecture hall.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              
              {/* For Students */}
              <div>
                <h3 className="text-sm font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider mb-8 flex items-center gap-2">
                  <User size={18} /> For Students
                </h3>
                
                {/* The Track */}
                <div className="relative ml-5 border-l-2 border-blue-100 dark:border-blue-900/50">
                  
                  {/* Step 1 */}
                  <div className="relative pl-10 pb-10">
                    <div className="absolute -left-5 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-950 border-2 border-blue-100 dark:border-blue-900 text-[#2563EB] dark:text-blue-400 shadow-sm z-10">
                      <Fingerprint size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">1. Set Up Once</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Link your phone to your matric number using FaceID, Fingerprint, or PIN. No passwords required.</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative pl-10 pb-10">
                    <div className="absolute -left-5 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-950 border-2 border-blue-100 dark:border-blue-900 text-[#2563EB] dark:text-blue-400 shadow-sm z-10">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">2. Tap the Link</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">When your lecturer starts a class, a &quot;Live Now&quot; banner appears on your hub. Tap it.</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative pl-10">
                    <div className="absolute -left-5 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-950 border-2 border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shadow-sm z-10">
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">3. Verified</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scan your biometrics. Our system verifies your location and identity instantly.</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* For Lecturers */}
              <div>
                <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-8 flex items-center gap-2">
                  <ShieldCheck size={18} /> For Lecturers
                </h3>
                
                {/* The Track */}
                <div className="relative ml-5 border-l-2 border-emerald-100 dark:border-emerald-900/50">
                  
                  {/* Step 1 */}
                  <div className="relative pl-10 pb-10">
                    <div className="absolute -left-5 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-950 border-2 border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shadow-sm z-10">
                      <Zap size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">1. Start Session</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tap &quot;Start Lecture&quot;. The system locks your GPS location as the class anchor.</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative pl-10 pb-10">
                    <div className="absolute -left-5 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-950 border-2 border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shadow-sm z-10">
                      <Activity size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">2. Live Radar</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Watch students check in live. Biometric check-ins auto-verify. GPS-only check-ins require your approval.</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative pl-10">
                    <div className="absolute -left-5 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-950 border-2 border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 shadow-sm z-10">
                      <Upload size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">3. Export</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download a Senate-ready CSV at the end of the semester. Fully NUC compliant.</p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
              Enterprise-grade security.
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto">
              We didn&apos;t build a simple form. We built a cryptographic attendance vault.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                <Fingerprint className="text-[#2563EB] dark:text-blue-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Biometric Lock</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Powered by WebAuthn. Your fingerprint or FaceID never leaves your device. We only store a cryptographic public key that proves it was you.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-6">
                <MapPin className="text-red-500 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Dynamic Geofencing</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Strict 250m radius for outdoor check-ins. Auto-expands to 800m indoors when GPS accuracy drops. You must physically be in the hall.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="text-amber-500 dark:text-amber-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Zero Proxy</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                One credential per student. One device per account. Our server blocks any attempt to check in multiple students from the same phone.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-6">
                <Activity className="text-emerald-500 dark:text-emerald-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Live Radar</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Watch students check in in real-time. See who is verified, who is flagged, and whose location is unstable — all on one screen.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6">
                <Bell className="text-purple-500 dark:text-purple-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Instant Alerts</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Never miss a lecture. When your lecturer starts a session, your phone gets a push notification instantly.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center mb-6">
                <Upload className="text-cyan-500 dark:text-cyan-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Senate-Ready CSV</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                One click to download a full semester report. Auto-calculates CA scores, attendance percentages, and NUC eligibility.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pt-16 pb-8 relative z-10 transition-colors duration-300">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              
              <div className="md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-[#2563EB] w-8 h-8 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="text-white" size={18} strokeWidth={2.5} />
                  </div>
                  <span className="font-black text-gray-900 dark:text-white text-lg tracking-tight">CampusCheck</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-4">
                  Secure, geofenced attendance tracking for Nigerian universities.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg w-fit border border-emerald-100 dark:border-emerald-800">
                  <Lock size={12} /> Secured by WebAuthn
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
                <ul className="space-y-3">
                  <li><Link href="/student-hub" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Student Hub</Link></li>
                  <li><Link href="/login" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Faculty Login</Link></li>
                  <li><Link href="/onboard" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Set Up Device</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
                <ul className="space-y-3">
                  <li><Link href="/privacy" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Terms of Service</Link></li>
                  <li>
                    <Link href="/status" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                      System Status <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Support</h4>
                <ul className="space-y-3">
                  <li className="text-sm font-medium text-gray-500 dark:text-gray-400">Questions? Email us at <br/><a href="mailto:support@youruniversity.edu" className="text-[#2563EB] dark:text-blue-400 hover:underline">support@youruniversity.edu</a></li>
                  <li className="text-sm font-medium text-gray-500 dark:text-gray-400 pt-2">Operated by <br/><strong className="text-gray-900 dark:text-white">[Your University Name]</strong></li>
                </ul>
              </div>

            </div>

            <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
                © {new Date().getFullYear()} CampusCheck. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-xs font-bold text-gray-400 dark:text-gray-500">
                <span>Made for Nigerian Universities</span>
                <span>•</span>
                <span>NUC Compliant</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        
        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium text-sm">Live Student Check-In</p>
        </div>

        <StudentCheckInComponent sessionId={sessionId} />

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center transition-colors duration-300">
        <Loader2 className="animate-spin text-[#2563EB] dark:text-blue-400 mb-4" size={32}/>
        <p className="text-gray-500 dark:text-gray-400 font-bold animate-pulse">Loading CampusCheck...</p>
      </div>
    }>
      <CheckInWrapper />
    </Suspense>
  );
}