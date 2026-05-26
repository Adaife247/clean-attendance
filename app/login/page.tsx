'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabase';
import { ShieldCheck, Loader2, Mail, Lock, User, Users, KeyRound, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const FACULTY_SECRET_KEY = process.env.NEXT_PUBLIC_FACULTY_KEY || "fuoye-2026";

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
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        window.location.href = '/dashboard';
      } else {
        if (secretKey !== FACULTY_SECRET_KEY) {
          throw new Error("Invalid Faculty Registration Key. Students cannot create accounts.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        
        if (data.user) {
          const { error: profileError } = await supabase.from('lecturers').insert([{
            id: data.user.id, full_name: fullName, department: department
          }]);
          if (profileError) throw profileError;
        }
        alert('Registration successful! You can now log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Faculty Access</h1>
          <p className="text-gray-500 mt-2 font-medium">CampusCheck Administration</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-6">
          
          <div className="flex bg-gray-50 p-1 rounded-xl mb-8">
            <button onClick={() => {setIsLogin(true); setError('');}} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLogin ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Sign In</button>
            <button onClick={() => {setIsLogin(false); setError('');}} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLogin ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Register</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-gray-400" /></div>
                  <input type="text" required placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Users size={18} className="text-gray-400" /></div>
                  <input type="text" required placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><KeyRound size={18} className="text-gray-400" /></div>
                  <input type="text" required placeholder="Faculty Registration Key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className="w-full bg-blue-50 border border-blue-200 text-blue-900 font-bold py-3 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all placeholder:text-blue-400" />
                </div>
              </>
            )}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={18} className="text-gray-400" /></div>
              <input type="email" required placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={18} className="text-gray-400" /></div>
              <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3 pl-11 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] transition-all" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 font-bold text-xs">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#2563EB] text-white font-bold text-lg py-3.5 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 mt-2">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />} 
              {isLogin ? 'Sign In Securely' : 'Create Faculty Account'}
            </button>
          </form>
        </div>

        {/* NEW: Back to Hub Navigation */}
        <div className="mt-6 text-center animate-in fade-in">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Back to Hub
          </Link>
        </div>

      </div>
    </div>
  );
}