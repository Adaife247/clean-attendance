'use client';
import { useState } from 'react';
import { Mail, Lock, User, Building, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase'; 

export default function LecturerLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');

  const handleAuth = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: dbError } = await supabase
            .from('lecturers')
            .insert([
              { 
                id: authData.user.id, 
                email: email, 
                full_name: fullName, 
                department: department 
              }
            ]);
            
          if (dbError) throw dbError;
          
          window.location.href = '/dashboard';
        } else {
          throw new Error("Signup failed. Please check your Supabase settings.");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        
        if (data.session) {
          window.location.href = '/dashboard';
        } else {
          throw new Error("No active session returned. Make sure 'Confirm Email' is OFF in Supabase.");
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || "An error occurred during authentication. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-md">
        
        {/* Bulletproof Branding Header */}
        <div className="text-center mb-8 flex flex-col items-center justify-center">
          <div className="bg-[#2563EB] w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 relative overflow-hidden">
            <ShieldCheck className="w-8 h-8 text-white z-10" strokeWidth={2.5} />
            <div className="absolute top-0 left-0 w-full h-1/2 bg-white/10 rounded-t-2xl"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-2 font-medium">Faculty Authentication Portal</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          
          {/* Toggle Tabs */}
          <div className="flex p-1 bg-gray-50 rounded-xl mb-8 border border-gray-100">
            <button 
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Sign In
            </button>
            <button 
              type="button"
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isSignUp ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Wrapper replacing the form tag */}
          <div className="space-y-4">
            
            {isSignUp && (
              <>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
                  <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Full Name (e.g. Dr. Ojo Emmanuel)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-transparent text-gray-900 font-medium py-3.5 pr-4 outline-none placeholder:text-gray-400 text-sm"
                  />
                </div>
                
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
                  <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                    <Building size={18} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Department (e.g. Computer Science)"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-transparent text-gray-900 font-medium py-3.5 pr-4 outline-none placeholder:text-gray-400 text-sm"
                  />
                </div>
              </>
            )}

            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
              <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                placeholder="Official Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-gray-900 font-medium py-3.5 pr-4 outline-none placeholder:text-gray-400 text-sm"
              />
            </div>

            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
              <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-gray-900 font-medium py-3.5 pr-4 outline-none placeholder:text-gray-400 text-sm"
              />
            </div>

            <button 
              type="button" 
              onClick={handleAuth}
              disabled={isLoading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-bold text-sm py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {isSignUp ? "Create Faculty Account" : "Secure Sign In"} <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

        </div>
        
        <p className="text-center text-xs font-semibold text-gray-400 mt-8">
          Secured by CampusCheck Zero-Trust Architecture
        </p>
      </div>
    </div>
  );
}