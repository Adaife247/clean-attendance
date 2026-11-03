import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Cookie Policy — CampusCheck',
  description: 'How CampusCheck uses cookies and local storage.',
};

export default function CookiesPage() {
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

          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Cookie & Storage Policy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
            Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
            <section>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">1. What are cookies?</h2>
              <p>
                Cookies are small text files that are stored on your device when you visit a website. CampusCheck uses cookies and similar technologies (like `localStorage` and `sessionStorage`) to keep you logged in, secure your session, and remember your preferences.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">2. How we use them</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-gray-900 dark:text-white">Essential Security Cookies:</strong> We use HTTP-only cookies to manage your WebAuthn challenge during login and check-in. Without these, the app cannot function securely.</li>
                <li><strong className="text-gray-900 dark:text-white">Session Storage:</strong> We store your encrypted student JWT in session storage. This is automatically deleted when you close your browser tab, keeping your account safe on shared devices.</li>
                <li><strong className="text-gray-900 dark:text-white">Local Storage:</strong> We store your theme preference (Light/Dark mode) and a device UUID to help prevent proxy attendance.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">3. Third-Party Cookies</h2>
              <p>
                We do not use advertising cookies or third-party tracking cookies. We use Sentry for error monitoring, which may set a session cookie to track application crashes. All data is anonymized.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">4. Managing Cookies</h2>
              <p>
                You can manage or delete cookies using your browser settings. However, if you block essential cookies, you will not be able to log in or check in to a lecture.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}