'use client';
import { useState } from 'react';
import { Mail, Lock, User, Building, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

export default function LecturerLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      setIsLoading(false);
      alert(isSignUp ? "Account creation triggered!" : "Login triggered!");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-md">
        
        {/* Fixed Branding Header */}
        <div className="text-center mb-8">
          <div className="bg-[#2563EB] text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck size={30} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CampusCheck</h1>
          <p className="text-gray-500 mt-2 font-medium">Faculty Authentication Portal</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          
          {/* Toggle Tabs */}
          <div className="flex p-1 bg-gray-50 rounded-xl mb-8 border border-gray-100">
            <button 
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isSignUp ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm font-semibold rounded-xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            
            {isSignUp && (
              <>
                {/* Fixed Flexbox Input Container */}
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:bg-white transition-all overflow-hidden">
                  <div className="pl-4 pr-3 flex items-center justify-center text-gray-400">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    required={isSignUp}
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
                    required={isSignUp}
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
                required
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
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-gray-900 font-medium py-3.5 pr-4 outline-none placeholder:text-gray-400 text-sm"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold text-sm py-4 rounded-xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {isSignUp ? "Create Faculty Account" : "Secure Sign In"} <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

        </div>
        
        <p className="text-center text-xs font-semibold text-gray-400 mt-8">
          Secured by CampusCheck Zero-Trust Architecture
        </p>
      </div>
    </div>
  );
}