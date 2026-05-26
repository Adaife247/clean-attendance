'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2, User, Search, MapPin } from 'lucide-react';
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
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md">
          
          <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-[#2563EB] w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
              <ShieldCheck className="w-10 h-10 text-white z-10" strokeWidth={2.5} />
              <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">CampusCheck</h1>
            <p className="text-gray-500 mt-2 font-medium">University Verification Engine</p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-4 animate-in fade-in slide-in-from-bottom-6">
            
            <Link 
              href="/portal" 
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm group-hover:text-[#2563EB] transition-colors">
                  <Search size={20} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900">Student Portal</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Check exam eligibility & records</p>
                </div>
              </div>
            </Link>

            <Link 
              href="/login" 
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm group-hover:text-gray-900 text-gray-500 transition-colors">
                  <User size={20} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900">Faculty Access</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Manage live radar & dashboards</p>
                </div>
              </div>
            </Link>
            
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 items-start animate-in fade-in slide-in-from-bottom-8">
            <MapPin className="text-[#2563EB] shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-blue-900 text-sm">Joining a Live Class?</h4>
              <p className="text-xs text-blue-700 font-medium mt-1 leading-relaxed">
                To check into an active lecture, please click the secure session link provided by your lecturer or Class Rep.
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
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-2 font-medium">Live Student Check-In</p>
        </div>

        <StudentCheckInComponent sessionId={sessionId} />

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><Loader2 className="animate-spin text-[#2563EB]" size={32}/></div>}>
      <CheckInWrapper />
    </Suspense>
  );
}