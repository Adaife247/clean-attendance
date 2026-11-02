'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowLeft, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function StatusPage() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          setStatus('ok');
          const data = await res.json();
          setTimestamp(new Date(data.timestamp).toLocaleString());
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    checkHealth();
    // Re-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center p-4 sm:p-6 font-sans relative overflow-hidden transition-colors duration-300">
      
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl relative z-10 pt-10">
        
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-white dark:bg-gray-900 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>

        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mx-auto mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">System Status</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Real-time operational status for CampusCheck.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-200 dark:border-gray-800 p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-6 transition-colors">
          
          <div className="space-y-6">
            {/* Overall Status */}
            <div className={`p-6 rounded-2xl border flex items-center justify-between transition-colors ${
              status === 'checking' ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' : 
              status === 'ok' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 
              'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-4">
                {status === 'checking' && <Activity className="text-gray-400 animate-pulse" size={32} />}
                {status === 'ok' && <CheckCircle className="text-emerald-500" size={32} />}
                {status === 'error' && <AlertTriangle className="text-red-500" size={32} />}
                
                <div>
                  <h2 className={`text-xl font-black ${
                    status === 'checking' ? 'text-gray-700 dark:text-gray-300' : 
                    status === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 
                    'text-red-700 dark:text-red-400'
                  }`}>
                    {status === 'checking' ? 'Checking Systems...' : 
                     status === 'ok' ? 'All Systems Operational' : 
                     'Systems Experiencing Issues'}
                  </h2>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {status === 'checking' ? 'Pinging database and API...' : 
                     status === 'ok' ? 'CampusCheck is running normally.' : 
                     'We are investigating the issue. Please try again shortly.'}
                  </p>
                </div>
              </div>

              {status === 'ok' && (
                <div className="hidden sm:flex flex-col items-end">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 mt-2 uppercase tracking-wider">Live</p>
                </div>
              )}
            </div>

            {/* Component List */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 transition-colors">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Core Services</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Database (Supabase)</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${status === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                    {status === 'checking' ? 'Checking...' : status === 'ok' ? 'Operational' : 'Unreachable'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">API Routes (Vercel)</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${status === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                    {status === 'checking' ? 'Checking...' : status === 'ok' ? 'Operational' : 'Degraded'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Biometric Auth (WebAuthn)</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${status === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                    {status === 'checking' ? 'Checking...' : status === 'ok' ? 'Operational' : 'Degraded'}
                  </span>
                </div>
              </div>
            </div>

            {timestamp && (
              <p className="text-center text-xs font-bold text-gray-400 dark:text-gray-500">
                Last checked: {timestamp}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}