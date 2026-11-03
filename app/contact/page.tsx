import { ArrowLeft, Mail, MessageSquare, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Contact Support — CampusCheck',
  description: 'Get help with CampusCheck.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans transition-colors duration-300">
      
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 md:p-10 transition-colors duration-300">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Back to home
          </Link>

          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Contact Support</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
            Need help? We are here for you.
          </p>

          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 flex items-start gap-4">
              <Mail className="text-[#2563EB] dark:text-blue-400 shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Email Support</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                  For general inquiries, account issues, or bugs, send us an email. We aim to respond within 24 hours.
                </p>
                <a href="mailto:support@campuscheck.com" className="text-[#2563EB] dark:text-blue-400 font-bold hover:underline">
                  support@campuscheck.com
                </a>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 flex items-start gap-4">
              <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Urgent Class Issues</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  If you are currently in a lecture and the app is failing, please contact your lecturer or class rep immediately. They have the tools to manually override your attendance.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex items-start gap-4">
              <MessageSquare className="text-gray-500 dark:text-gray-400 shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Read the FAQ</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                  Most questions about GPS issues, device resets, and attendance percentages are answered in our FAQ.
                </p>
                <Link href="/faq" className="text-[#2563EB] dark:text-blue-400 font-bold hover:underline">
                  View FAQ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}