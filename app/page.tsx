'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import StudentCheckIn from '@/components/StudentCheckIn';
import { AlertTriangle } from 'lucide-react';

function CheckInFlow() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  // If there is no session ID in the URL, the link is broken
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-red-100 p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Invalid Link</h2>
          <p className="text-gray-500 mt-2 text-sm">Please ask the lecturer for the correct check-in link or scan the QR code on the projector.</p>
        </div>
      </div>
    );
  }

  // Pass the ID straight to the unified UI
  return <StudentCheckIn sessionId={sessionId} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckInFlow />
    </Suspense>
  );
}