// ─── app/error.tsx ───
'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import * as Sentry from "@sentry/nextjs"; // NEW

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // NEW: Send the crash to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">
          Something broke
        </h1>
        <p className="text-sm text-gray-600 font-medium mb-6 leading-relaxed">
          An unexpected error interrupted this page. Your data is safe. Try
          refreshing, or head back to the home screen.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition-all"
          >
            <RefreshCw size={18} /> Try again
          </button>
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all"
          >
            <ArrowLeft size={18} /> Go home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs font-mono text-gray-400">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}