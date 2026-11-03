'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Radio, Megaphone, Users, BarChart3, X } from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!isOpen) return null;

  const links = [
    { name: 'Live Radar', href: '/dashboard', icon: <Radio size={18} /> },
    { name: 'Broadcast & Announcements', href: '/dashboard/broadcast', icon: <Megaphone size={18} /> },
    { name: 'Course & Student Management', href: '/dashboard/courses', icon: <Users size={18} /> },
    { name: 'Analytics & Reports', href: '/dashboard/analytics', icon: <BarChart3 size={18} /> },
    { name: 'HOD Command Center', href: '/hod', icon: <BarChart3 size={18} /> },
  ];

  const filteredLinks = links.filter((link) =>
    link.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 bg-gray-900/50 dark:bg-black/60 z-100 flex items-start justify-center pt-[15vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-gray-100 dark:border-gray-800">
          <Search size={20} className="text-gray-400" />
          <input
            autoFocus
            type="text"
            placeholder="Search pages or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-gray-900 dark:text-white py-4 pl-3 outline-none font-medium placeholder:text-gray-400"
          />
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
        <div className="p-2 max-h-75 overflow-y-auto">
          {filteredLinks.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-6">No results found.</p>
          ) : (
            filteredLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => {
                  router.push(link.href);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-left"
              >
                {link.icon}
                <span className="font-semibold">{link.name}</span>
              </button>
            ))
          )}
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 text-xs text-gray-400 font-medium text-center border-t border-gray-100 dark:border-gray-800">
          Press <kbd className="bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}