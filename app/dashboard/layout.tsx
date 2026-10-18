'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../../utils/supabase';
import { 
  Radio, BarChart3, LogOut, ShieldCheck, Menu, X, Users, Award, Megaphone
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHod, setIsHod] = useState(false);

  useEffect(() => {
    const checkHodStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('lecturers').select('department').eq('id', session.user.id).single();
      if (data?.department) setIsHod(true);
    };
    checkHodStatus();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const navItems = [
    { name: 'Live Radar', href: '/dashboard', icon: Radio },
    { name: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone },
    { name: 'Student Management', href: '/dashboard/courses', icon: Users },
    { name: 'Analytics & Reports', href: '/dashboard/analytics', icon: BarChart3 },
  ];

  if (isHod) {
    navItems.push({ name: 'HOD Command Center', href: '/hod', icon: Award });
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden font-sans">
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[#2563EB]" size={24} strokeWidth={2.5} />
          <span className="font-extrabold text-gray-900 text-lg tracking-tight">CampusCheck</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-gray-50 rounded-lg text-gray-600 border border-gray-200">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform duration-300 ease-in-out
        fixed md:static top-16 md:top-0 left-0 h-[calc(100vh-4rem)] md:h-screen w-64 
        bg-white border-r border-gray-200 flex flex-col z-40 shadow-xl md:shadow-none
      `}>
        <div className="hidden md:flex h-20 items-center gap-3 px-6 border-b border-gray-100">
          <div className="bg-[#2563EB] text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-gray-900 text-xl tracking-tight">CampusCheck</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all ${
                  isActive 
                    ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-bold text-sm bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all">
            <LogOut size={16} strokeWidth={2.5} /> Secure Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto pt-16 md:pt-0">
        {children}
      </main>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900/20 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
}