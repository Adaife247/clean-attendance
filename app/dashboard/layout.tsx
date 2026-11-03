'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabase';
import { 
  Radio, BarChart3, LogOut, ShieldCheck, Menu, X, Users, Award, Megaphone, Search
} from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import CommandPalette from '@/components/CommandPalette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHod, setIsHod] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const { data } = await supabase.from('lecturers').select('department').eq('id', session.user.id).single();
      if (data?.department) setIsHod(true);
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const navItems = [
    { name: 'Live Radar', href: '/dashboard', icon: Radio },
    { name: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone },
    { name: 'Course & Student Management', href: '/dashboard/courses', icon: Users },
    { name: 'Analytics & Reports', href: '/dashboard/analytics', icon: BarChart3 },
  ];

  if (isHod) {
    navItems.push({ name: 'HOD Command Center', href: '/hod', icon: Award });
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB] dark:bg-gray-950 overflow-hidden font-sans transition-colors duration-300">
      
      <CommandPalette />

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50 flex items-center justify-between px-4 transition-colors">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[#2563EB] dark:text-blue-400" size={24} strokeWidth={2.5} />
          <span className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">CampusCheck</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button aria-label="Logout" onClick={handleLogout} className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
            <LogOut size={18} strokeWidth={2.5} />
          </button>
          <button aria-label="Toggle Menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors">
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform duration-300 ease-in-out
        fixed md:static top-16 md:top-0 left-0 h-[calc(100vh-4rem)] md:h-screen w-64 
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 shadow-xl md:shadow-none
      `}>
        <div className="hidden md:flex h-20 items-center justify-between px-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#2563EB] text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
              <ShieldCheck size={22} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-gray-900 dark:text-white text-xl tracking-tight">CampusCheck</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="p-4">
          <button 
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors"
          >
            <Search size={16} />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] font-bold bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
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
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 transition-colors">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-bold text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all">
            <LogOut size={16} strokeWidth={2.5} /> Secure Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto pt-16 md:pt-0 bg-[#F9FAFB] dark:bg-gray-950 transition-colors duration-300">
        {children}
      </main>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900/20 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </div>
  );
}