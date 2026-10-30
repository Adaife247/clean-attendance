// ─── app/terms/page.tsx ───
// ⚠️ TEMPLATE. Review with legal counsel before shipping.

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — CampusCheck',
  description: 'The rules for using CampusCheck.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>

        <h1 className="text-3xl font-black text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 font-medium mb-8">
          Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="space-y-6 text-gray-700 leading-relaxed text-sm">
          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">1. Acceptance</h2>
            <p>
              By using CampusCheck you agree to these terms. If you do not
              agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">2. Eligibility</h2>
            <p>
              CampusCheck is available only to students and lecturers of
              [EDIT: YOUR INSTITUTION]. Accounts must be linked to a valid
              matriculation number.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">3. Acceptable use</h2>
            <p>You agree <strong>not</strong> to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Attempt to check in for another student.</li>
              <li>Spoof GPS location or tamper with device fingerprints.</li>
              <li>Reverse engineer, attack, or overload the service.</li>
              <li>Share your check-in link with anyone outside your class.</li>
            </ul>
            <p className="mt-2">
              Violation may lead to disqualification from attendance records
              and disciplinary action by your institution.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">4. Attendance accuracy</h2>
            <p>
              While we work hard to prevent fraud, no system is perfect.
              Attendance decisions are ultimately made by your lecturer and
              institution. CampusCheck is a tool, not the final authority.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">5. Availability</h2>
            <p>
              We aim for 99% uptime but do not guarantee it. Downtime may occur
              for maintenance or reasons outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">6. Liability</h2>
            <p>
              CampusCheck is provided &quot;as is&quot; without warranty. To
              the maximum extent permitted by law, we are not liable for
              indirect damages arising from use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-gray-900 mb-2">7. Contact</h2>
            <p>
              Questions? Email{' '}
              <a href="mailto:[EDIT: SUPPORT EMAIL]" className="text-[#2563EB] underline">
                [EDIT: SUPPORT EMAIL]
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}