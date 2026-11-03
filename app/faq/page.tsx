import { ArrowLeft, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'FAQ — CampusCheck',
  description: 'Frequently asked questions about CampusCheck.',
};

const faqs = [
  {
    question: 'Why is my check-in being blocked?',
    answer: 'There are a few reasons this might happen. Most commonly, you are outside the GPS radius of the lecture hall, or you are using a mock GPS app. You can check the exact reason on your screen when you are blocked. If you believe it is an error, use the "Raise Hand" button to ask your lecturer for a manual override.',
  },
  {
    question: 'Can I use the same account on a new phone?',
    answer: 'Your account is cryptographically bound to the physical hardware of your original phone. If you change phones, you must ask your lecturer to use the "Wipe Device Lock" tool in their dashboard. Once they do, you can set up your biometrics on the new phone.',
  },
  {
    question: 'Why does it say "Biometric verification failed"?',
    answer: 'CampusCheck requires a physical fingerprint, FaceID, or screen lock to check in. If you cancel the biometric prompt, the system will block the check-in. Try again and ensure you complete the biometric scan.',
  },
  {
    question: 'What happens if my phone dies in class?',
    answer: 'If your phone dies, you can ask your Class Rep to log you as "Dead Battery" in their Rep Desk. This will send a manual override request to your lecturer, who can approve it.',
  },
  {
    question: 'How is my attendance calculated?',
    answer: 'CampusCheck calculates your attendance percentage based on the total number of classes held so far (or the total planned classes at the end of the semester). You need to maintain a minimum of 70% attendance to be eligible for your exams (NUC standard).',
  },
  {
    question: 'Is my biometric data safe?',
    answer: 'Yes. CampusCheck uses WebAuthn technology. Your fingerprint or FaceID never leaves your phone. We only store a cryptographic public key that proves your device is yours.',
  },
];

export default function FAQPage() {
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

          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Frequently Asked Questions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
            Everything you need to know about using CampusCheck.
          </p>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details 
                key={index} 
                className="group bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer p-5 font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  {faq.question}
                  <span className="transition-transform duration-300 group-open:-rotate-180">
                    <ChevronDown size={20} className="text-gray-400" />
                  </span>
                </summary>
                <div className="p-5 pt-0 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 mt-2">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}