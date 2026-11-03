import { ArrowLeft, GitCommit } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Changelog — CampusCheck',
  description: 'Recent updates and improvements to CampusCheck.',
};

const updates = [
  {
    version: 'v1.2.0',
    date: 'Today',
    title: 'The "Zero Proxy" Update',
    description: 'Major security and UX overhaul.',
    items: [
      'Introduced hardware-bound WebAuthn biometrics.',
      'Added persistent device binding (blocks cache clearing & incognito).',
      'Implemented the "Check-in Trap" (blocks one device checking in multiple students).',
      'Added strict server-side GPS spoofing detection (DeviceMotion & GeoTrustIn).',
      'Introduced the XP & Levels system for students.',
      'Added the Command Palette (⌘K) for lecturers.',
      'Full WCAG 2.2 AA Accessibility pass.',
    ],
  },
  {
    version: 'v1.1.0',
    date: 'Last Week',
    title: 'Lecturer & Rep Tools',
    description: 'Empowering lecturers and class reps.',
    items: [
      'Added the Live Radar dashboard.',
      'Created the Class Rep Backup Anchor feature.',
      'Added "Log Dead Battery" for class reps.',
      'Implemented CSV export for Senate reporting.',
    ],
  },
  {
    version: 'v1.0.0',
    date: 'Launch',
    title: 'Initial Release',
    description: 'The first stable version of CampusCheck.',
    items: [
      'Basic GPS geofencing check-in.',
      'Student portal with attendance tracking.',
      'Course & Roster management.',
      'Live push notifications for class starts.',
    ],
  },
];

export default function ChangelogPage() {
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

          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Changelog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-10">
            New updates and improvements to CampusCheck.
          </p>

          <div className="space-y-12">
            {updates.map((update, index) => (
              <div key={index} className="relative pl-8 md:pl-0">
                <div className="md:grid md:grid-cols-4 md:gap-8">
                  
                  {/* Date / Version Column */}
                  <div className="mb-2 md:mb-0 md:text-right md:pr-8 md:border-r border-gray-200 dark:border-gray-800 relative">
                    <div className="hidden md:block absolute top-1.5 -right-1.25 w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-4 ring-white dark:ring-gray-900" />
                    <p className="text-sm font-black text-gray-900 dark:text-white">{update.version}</p>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">{update.date}</p>
                  </div>

                  {/* Content Column */}
                  <div className="md:col-span-3 md:pl-8">
                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                      <GitCommit size={18} className="text-[#2563EB]" /> {update.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{update.description}</p>
                    <ul className="space-y-2">
                      {update.items.map((item, i) => (
                        <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-[#2563EB] mt-1">•</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}