'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabase';
import { ShieldCheck, Loader2, Mail, Lock, User, Users, KeyRound, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [secretKey, setSecretKey] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        
        if (signInError) throw signInError;
        
        if (data.session) {
          router.refresh();
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 800);
        } else {
          throw new Error("Login successful, but no session was created.");
        }
      } else {
        // SECURE SIGNUP: Hits our new server route
        const res = await fetch('/api/lecturer-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName, department, secretKey })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Registration failed');
        }

        alert('Registration successful! You can now log in.');
        setIsLogin(true);
        setLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
        </div>

        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-[#2563EB] w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 mb-5 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
            <ShieldCheck className="w-10 h-10 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-3xl"></div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Faculty Access</h1>
          <p className="text-gray-600 mt-2 font-semibold text-base">CampusCheck Administration</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-gray-300/30 border border-gray-100 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-6">
          
          <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8">
            <button onClick={() => {setIsLogin(true); setError('');}} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Sign In</button>
            <button onClick={() => {setIsLogin(false); setError('');}} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Register</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
                  <input aria-label="Full Name" type="text" required placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3.5 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Users size={18} className="text-gray-400" /></div>
                  <input aria-label="Department" type="text" required placeholder="Department (e.g., CSC)" value={department} onChange={(e) => setDepartment(e.target.value.toUpperCase())} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3.5 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all uppercase" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><KeyRound size={18} className="text-gray-400" /></div>
                  <input aria-label="Faculty Registration Key" type="password" required placeholder="Faculty Registration Key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="w-full bg-blue-50 border border-blue-200 text-blue-900 font-bold py-3.5 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all placeholder:text-blue-400" />
                </div>
              </>
            )}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={18} className="text-gray-400" /></div>
              <input aria-label="Email Address" type="email" required placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3.5 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={18} className="text-gray-400" /></div>
              <input aria-label="Password" type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3.5 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 font-bold text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 mt-6">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />} 
              {isLogin ? 'Sign In Securely' : 'Create Faculty Account'}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center animate-in fade-in pb-8">
          <p className="text-xs font-bold text-gray-400">© 2026 CampusCheck. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}