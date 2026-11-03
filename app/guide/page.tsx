import { ArrowLeft, User, ShieldCheck, Star, MapPin, AlertTriangle, Upload, CheckCircle, Search, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'User Guide — CampusCheck',
  description: 'Learn how to use CampusCheck.',
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans transition-colors duration-300">
      
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 md:p-10 transition-colors duration-300">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Back to home
          </Link>

          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-[#2563EB] dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={32} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-4">User Guide</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 font-medium max-w-2xl mx-auto">
              Everything you need to know to navigate CampusCheck like a pro.
            </p>
          </div>

          <div className="space-y-12">
            
            {/* STUDENT SECTION */}
            <section>
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2">
                <User className="text-[#2563EB]" size={24} />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">For Students</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">1. The Live Class Banner</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    When your lecturer starts a session, a green <strong>&quot;Live Class Now&quot;</strong> banner will appear at the top of your Student Hub. You do not need to refresh the page. Just tap the banner to start checking in.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 flex items-center gap-2"><Star className="text-amber-500" size={18} /> 2. XP & Streaks</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    We believe attendance should be rewarded. You earn <strong>10 XP</strong> for every class you attend, plus a bonus of <strong>5 XP</strong> for every point in your current streak.
                  </p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li><strong>Rookie (Level 1):</strong> 0 - 500 XP</li>
                    <li><strong>Regular (Level 2):</strong> 501 - 1500 XP</li>
                    <li><strong>Scholar (Level 3):</strong> 1501 - 3000 XP</li>
                    <li><strong>Legend (Level 4):</strong> 3000+ XP</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 flex items-center gap-2"><AlertTriangle className="text-orange-500" size={18} /> 3. Troubleshooting Check-ins</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    If you are blocked, read the screen carefully. The system tells you exactly why.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400"><strong>If it says &quot;You are out of bounds&quot;:</strong> You are too far from the lecturer&apos;s GPS anchor. Move closer to the front of the hall and click <strong>Try Again</strong>.</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400"><strong>If it says &quot;Location is blocked&quot;:</strong> You have denied location permissions in your browser. Follow the on-screen steps to allow it.</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400"><strong>If it says &quot;This phone is already linked&quot;:</strong> You are trying to use a friend&apos;s phone. You must use your own device.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* REP SECTION */}
            <section>
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2">
                <Upload className="text-emerald-600" size={24} />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">For Class Reps</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">1. The Rep Desk</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    If your lecturer designates you as a Class Rep, a new <strong>&quot;Rep Desk&quot;</strong> tab will appear in your hub. From here, you can help manage the class.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">2. Logging Dead Batteries</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    If a student&apos;s phone dies during a lecture, you can log their matric number in the Rep Desk. This sends a manual override request to the lecturer. <strong>Note:</strong> You can only log a maximum of 3 students per class.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">3. Backup Anchor</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    If the lecturer&apos;s phone is dead or missing, you can start a backup session from your own phone. Your phone&apos;s GPS will become the anchor for the lecture hall. Only do this if the lecturer explicitly asks you to.
                  </p>
                </div>
              </div>
            </section>

            {/* LECTURER SECTION */}
            <section>
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2">
                <ShieldCheck className="text-[#2563EB]" size={24} />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">For Lecturers</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 flex items-center gap-2"><MapPin className="text-red-500" size={18} /> 1. Starting a Session</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    Go to the <strong>Live Radar</strong> tab, select your course, set the duration, and click <strong>Establish Geofence</strong>. Stand in the middle of the hall when you do this so the GPS anchor is accurate.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 flex items-center gap-2"><Search className="text-purple-500" size={18} /> 2. Managing Flags</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    On the <strong>Course & Student Management</strong> page, scroll down to the <strong>Security Flags</strong> section. Here, you will see any students who tried to cheat the system (e.g., proxy attempts, fake GPS). You can click on a flag group to see the evidence, and approve or reject their check-in.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 flex items-center gap-2"><CheckCircle className="text-emerald-500" size={18} /> 3. Wiping Device Locks</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                    If a student loses their phone or buys a new one, they cannot log in. Use the <strong>Wipe Device Lock</strong> tool at the bottom of the management page to clear their hardware binding. They can then set up the new phone.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}