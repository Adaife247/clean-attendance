// ─── app/privacy/page.tsx ───
// ⚠️ IMPORTANT: Review with your institution's legal team before launching to real students.

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata = {
  title: 'Privacy Policy — CampusCheck',
  description: 'How CampusCheck collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8 font-sans transition-colors duration-300">
      
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 md:p-10 transition-colors duration-300">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>

        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
          Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">1. Who we are</h2>
            <p>
              CampusCheck is operated by <strong className="text-gray-900 dark:text-white">[Your University Name]</strong>, located at
              <strong className="text-gray-900 dark:text-white"> [Your University Address]</strong>. For privacy inquiries, contact:{' '}
              <a href="mailto:privacy@youruniversity.edu" className="text-[#2563EB] dark:text-blue-400 underline">
                privacy@youruniversity.edu
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">2. Data we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-900 dark:text-white">Matriculation number</strong> — to identify your attendance record.</li>
              <li><strong className="text-gray-900 dark:text-white">Biometric credential</strong> — a WebAuthn public key stored on our server. Your fingerprint or face data never leaves your device.</li>
              <li><strong className="text-gray-900 dark:text-white">Hardware fingerprint</strong> — a cryptographic hash derived from your device&apos;s graphics card (Canvas/WebGL) and browser settings. This is used to prevent proxy attendance (creating multiple accounts on one phone).</li>
              <li><strong className="text-gray-900 dark:text-white">Motion sensor data</strong> — acceleration and orientation data collected during check-in. This is used solely to verify that you are physically holding your phone and not using a spoofing app on a stationary device.</li>
              <li><strong className="text-gray-900 dark:text-white">Location</strong> — GPS coordinates and accuracy data during check-in, used to confirm you are inside the lecture hall.</li>
              <li><strong className="text-gray-900 dark:text-white">Network information</strong> — your IP address, used strictly for security auditing, rate limiting, and fraud detection.</li>
              <li><strong className="text-gray-900 dark:text-white">Course enrollment</strong> — course codes you are registered for.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">3. How we use it</h2>
            <p>
              We use this data only to record class attendance, prevent proxy sign-ins, detect GPS spoofing, and generate attendance reports for your lecturer and institution. We do not sell your data, and we do not use it for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">4. Security Audits</h2>
            <p>
              Every check-in attempt (successful or failed) is logged in a secure audit trail. If the system detects suspicious behavior (e.g., two different students checking in from the same device), this flag is shared with your lecturer for manual review.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">5. Where data is stored</h2>
            <p>
              Data is stored securely in Supabase (AWS) and processed via Vercel (Global Edge Network). Both providers use industry-standard encryption in transit and at rest.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">6. Retention</h2>
            <p>
              Attendance records and security audit logs are retained for the duration of your academic programme plus one (1) year to support institutional audits, then deleted. Hardware fingerprints are permanently purged when you request a device reset via your lecturer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">7. Your rights</h2>
            <p>
              You can request a copy of your data, correction of inaccuracies, or full deletion by emailing{' '}
              <a href="mailto:privacy@youruniversity.edu" className="text-[#2563EB] dark:text-blue-400 underline">
                privacy@youruniversity.edu
              </a>
              . If you believe your data has been misused, you may contact your institution&apos;s data protection officer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">8. Changes</h2>
            <p>
              We may update this policy. Material changes will be announced on the CampusCheck home page at least 14 days before taking effect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}