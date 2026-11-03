// ─── app/terms/page.tsx ───
// ⚠️ TEMPLATE. Review with legal counsel before shipping.

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata = {
  title: 'Terms of Service — CampusCheck',
  description: 'The rules for using CampusCheck.',
};

export default function TermsPage() {
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

        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
          Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">1. Acceptance</h2>
            <p>
              By using CampusCheck you agree to these terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">2. Eligibility</h2>
            <p>
              CampusCheck is available only to students and lecturers of
              <strong className="text-gray-900 dark:text-white"> [Your University Name]</strong>. Accounts must be linked to a valid matriculation number.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">3. Acceptable use</h2>
            <p>You agree <strong className="text-gray-900 dark:text-white">not</strong> to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Engage in Proxy Attendance:</strong> Checking in on behalf of another student, or asking another student to check in for you.</li>
              <li><strong>Share Your Device:</strong> Handing your unlocked phone to another student to bypass the biometric lock.</li>
              <li><strong>Spoof Your Location or Sensors:</strong> Using mock GPS applications, rooted devices, or hardware injectors to fake your location, speed, or accelerometer data.</li>
              <li><strong>Manipulate Hardware Fingerprints:</strong> Attempting to bypass device-binding rules by clearing caches, using incognito modes, or spoofing Canvas/WebGL signatures.</li>
              <li><strong>Attack the Service:</strong> Reverse engineer, overload, or attempt to bypass the rate limiting and audit logging systems.</li>
            </ul>
            <p className="mt-3">
              Violation of these rules will result in the check-in being blocked or flagged. The system provides this forensic evidence directly to your lecturer, which may lead to disqualification from attendance records and disciplinary action by your institution.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">4. Attendance accuracy</h2>
            <p>
              While we work hard to prevent fraud, no software system is perfect. CampusCheck uses advanced heuristics to flag suspicious activity (such as identical devices or motion sensor mismatches), but final attendance decisions are made by your lecturer. CampusCheck is an investigative tool, not the final authority.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">5. Availability</h2>
            <p>
              We aim for 99% uptime but do not guarantee it. Downtime may occur for maintenance or reasons outside our control. Offline check-ins are queued locally and synced when the connection is restored.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">6. Device Compatibility</h2>
            <p>
              CampusCheck requires a device with a modern browser, GPS capabilities, and hardware support for WebAuthn (FaceID, TouchID, or screen lock). It is your responsibility to ensure your device is charged and functional before attending a lecture.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">7. Liability</h2>
            <p>
              CampusCheck is provided &quot;as is&quot; without warranty. To the maximum extent permitted by law, we are not liable for indirect damages arising from use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">8. Contact</h2>
            <p>
              Questions? Email{' '}
              <a href="mailto:support@youruniversity.edu" className="text-[#2563EB] dark:text-blue-400 underline">
                support@youruniversity.edu
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}