'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2, User, Search, Zap, ArrowRight } from 'lucide-react';
import StudentCheckInComponent from '../components/StudentCheckIn'; 
import Link from 'next/link';

function CheckInWrapper() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  // ==========================================
  // STATE 1: THE UNIVERSAL HUB (No active link)
  // ==========================================
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
        
        {/* Decorative background gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
          
          <div className="text-center mb-10 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-[#2563EB] w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-6 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
              <ShieldCheck className="w-12 h-12 text-white z-10" strokeWidth={2.5} />
              <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-3xl"></div>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">CampusCheck</h1>
            <p className="text-gray-500 mt-2 font-semibold text-lg">Your University Survival Companion</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-4xl shadow-xl shadow-gray-200/50 border border-white p-6 sm:p-8 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            
            <Link 
              href="/portal" 
              className="group relative w-full flex items-center justify-between p-5 bg-linear-to-r from-gray-50 to-white hover:from-blue-50 hover:to-blue-50/50 border border-gray-200 hover:border-blue-300 rounded-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-[#2563EB] transition-colors"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white p-3.5 rounded-xl shadow-sm text-gray-500 group-hover:text-[#2563EB] transition-colors border border-gray-100">
                  <Search size={22} />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-gray-900 text-lg">Student Portal</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Check Clearance Shield & records</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-gray-300 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </Link>

            <Link 
              href="/login" 
              className="group relative w-full flex items-center justify-between p-5 bg-linear-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 border border-gray-200 hover:border-gray-400 rounded-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-gray-900 transition-colors"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white p-3.5 rounded-xl shadow-sm text-gray-500 group-hover:text-gray-900 transition-colors border border-gray-100">
                  <User size={22} />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-gray-900 text-lg">Faculty Access</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Manage live radar & analytics</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-gray-300 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
            </Link>
            
          </div>

          <div className="mt-8 bg-blue-600 text-white p-5 rounded-2xl flex gap-4 items-center shadow-lg shadow-blue-600/20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm">Joining a Live Class?</h4>
              <p className="text-xs text-blue-100 font-medium mt-1 leading-relaxed">
                Click the secure session link provided by your lecturer to mark your attendance.
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // STATE 2: ACTIVE CHECK-IN (Bypasses Hub)
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        
        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-1 font-medium text-sm">Live Student Check-In</p>
        </div>

        <StudentCheckInComponent sessionId={sessionId} />

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#2563EB] mb-4" size={32}/>
        <p className="text-gray-500 font-bold animate-pulse">Loading CampusCheck...</p>
      </div>
    }>
      <CheckInWrapper />
    </Suspense>
  );
}