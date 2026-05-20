'use client';
import { useState } from 'react';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // If password is correct, the cookie is set. Redirect to dashboard!
        window.location.href = '/dashboard';
      } else {
        setError('Incorrect password. Access denied.');
        setPassword('');
      }
    } catch (err) {
      setError('Connection failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-8">
        <div className="bg-gray-900 text-white w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-md">
          <Lock size={28} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Lecturer Access</h2>
        <p className="text-gray-500 mt-2 text-sm font-medium mb-8">
          This zone is restricted to authorized personnel.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="Enter Master Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-lg py-4 px-6 rounded-2xl outline-none focus:ring-2 focus:ring-gray-900 transition-all placeholder:font-medium placeholder:text-gray-400 tracking-widest"
            autoFocus
          />

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm font-semibold">
              <ShieldAlert size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || password.length < 4}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold text-lg py-4 rounded-2xl shadow-md hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Unlock Dashboard'}
            <ArrowRight size={20} className={isLoading ? 'hidden' : 'block'} />
          </button>
        </form>
      </div>
    </div>
  );
}