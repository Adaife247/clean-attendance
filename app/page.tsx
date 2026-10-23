'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2, Search, Zap, ArrowRight, Lock } from 'lucide-react';
import StudentCheckInComponent from '../components/StudentCheckIn'; 
import Link from 'next/link';

function CheckInWrapper() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

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
            <p className="text-gray-700 mt-2 font-bold text-lg">Secure Attendance & Clearance</p>
          </div>

          <div className="bg-white rounded-4xl shadow-2xl shadow-gray-300/30 border border-gray-100 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            
            <div className="space-y-4">
              {/* HIGH CONTRAST BRANDED BUTTON */}
              <Link 
                href="/portal" 
                className="group relative w-full flex items-center justify-center gap-2 py-5 px-6 bg-[#2563EB] hover:bg-blue-700 rounded-2xl transition-all duration-300 overflow-hidden shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.4)]"
              >
                <Search size={22} className="text-white" strokeWidth={3} />
                <span className="font-black text-white text-xl tracking-wide">Enter Student Portal</span>
                <ArrowRight size={22} className="text-white group-hover:translate-x-1 transition-all absolute right-6" strokeWidth={3} />
              </Link>
              
              <p className="text-center text-sm font-bold text-gray-500">
                Check your Clearance Shield & attendance records
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <Link 
                href="/login" 
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-11 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider rounded-xl hover:bg-gray-100"
              >
                <Lock size={14} /> Faculty Sign In
              </Link>
            </div>
            
          </div>

          <div className="mt-8 bg-gray-900 text-white p-5 rounded-2xl flex gap-4 items-center shadow-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <div className="bg-white/10 p-2.5 rounded-xl shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Live Class in Session?</p>
              <p className="text-xs text-gray-300 font-medium mt-1 leading-relaxed">
                Log in with your Matric Number. If your lecturer has started a class, a <strong className="text-white">&quot;Live Now&quot;</strong> banner will appear.
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

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