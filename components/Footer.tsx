'use client';
import Link from 'next/link';
import { ShieldCheck, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pt-16 pb-8 relative z-10 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#2563EB] w-8 h-8 rounded-lg flex items-center justify-center">
                <ShieldCheck className="text-white" size={18} strokeWidth={2.5} />
              </div>
              <span className="font-black text-gray-900 dark:text-white text-lg tracking-tight">CampusCheck</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-4">
              Secure, geofenced attendance tracking for Nigerian universities.
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg w-fit border border-emerald-100 dark:border-emerald-800">
              <Lock size={12} /> Secured by WebAuthn
            </div>
          </div>

                    <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/student-hub" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Student Portal</Link></li>
              <li><Link href="/login" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Faculty Login</Link></li>
              <li><Link href="/onboard" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Link Device</Link></li>
              <li><Link href="/guide" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">User Guide</Link></li>
              <li><Link href="/changelog" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Changelog</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link href="/faq" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">FAQ & Help</Link></li>
              <li><Link href="/contact" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Contact Support</Link></li>
              <li>
                <Link href="/status" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors flex items-center gap-2">
                  System Status <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Terms of Service</Link></li>
              <li><Link href="/cookies" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2563EB] dark:hover:text-blue-400 transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} CampusCheck. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs font-bold text-gray-400 dark:text-gray-500">
            <span>Made for Nigerian Universities</span>
            <span>•</span>
            <span>NUC Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}