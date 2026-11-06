import { ArrowLeft, ShieldCheck, MapPin, Lock } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'About — CampusCheck',
  description: 'Our mission to secure academic integrity.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans transition-colors duration-300">
      
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 md:p-10 transition-colors duration-300">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Back to home
          </Link>

          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-[#2563EB] dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Our Mission</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 font-medium leading-relaxed max-w-2xl mx-auto">
              To eliminate proxy attendance in Nigerian universities and restore the integrity of academic compliance.
            </p>
          </div>

          <div className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              Paper attendance sheets are broken. They are easily signed by friends, lost, torn, or destroyed by water spills. Worse still, they provide no reliable data for NUC compliance audits, leaving universities vulnerable.
            </p>
            <p>
              CampusCheck was built to solve this. We didn&apos;t just build a digital form; we built a cryptographic vault. By combining hardware-bound biometrics (WebAuthn) with strict GPS geofencing and device fingerprinting, we make it extremely difficult and easily traceable for a student to check in for an absent friend.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-10">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                <Lock className="text-[#2563EB] dark:text-blue-400 mb-3" size={24} />
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Proxy-Resistant Design</h3>
                <p className="text-sm">One device per student. Clearing cache or switching browsers flags our hardware locks for immediate review.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                <MapPin className="text-[#2563EB] dark:text-blue-400 mb-3" size={24} />
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Physical Presence</h3>
                <p className="text-sm">Strict GPS boundaries and motion sensor cross-checks ensure students are actually inside the lecture hall.</p>
              </div>
            </div>

            <p>
              We built CampusCheck to be fast, reliable, and accessible even on low-end devices and slow networks. It is designed specifically for the realities of the Nigerian university environment.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}