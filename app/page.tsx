'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import StudentCheckInComponent from '../components/StudentCheckIn'; 

function CheckInWrapper() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  // 1. Block access if there is no session link
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

  // 2. Load the Premium Branding + The Real WebAuthn Component
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-2 font-medium">Student Check-In Portal</p>
        </div>

        <StudentCheckInComponent sessionId={sessionId} />

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32}/></div>}>
      <CheckInWrapper />
    </Suspense>
  );
}