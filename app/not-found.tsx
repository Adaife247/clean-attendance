// ─── app/not-found.tsx ───
import { Compass, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Compass size={32} />
        </div>
        <p className="text-6xl font-black text-gray-900 mb-2">404</p>
        <h1 className="text-xl font-extrabold text-gray-900 mb-2">
          Page not found
        </h1>
        <p className="text-sm text-gray-600 font-medium mb-6 leading-relaxed">
          This link might be broken, expired, or never existed. If you got here
          from a check-in link, ask your lecturer for a fresh one.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition-all"
          >
            <Home size={18} /> Home
          </Link>
          <Link
            href="/portal"
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all"
          >
            <ArrowLeft size={18} /> Student portal
          </Link>
        </div>
      </div>
    </div>
  );
}