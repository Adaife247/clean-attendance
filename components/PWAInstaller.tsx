'use client';
import { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Download } from 'lucide-react';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export default function PWAInstaller() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      const ua = window.navigator.userAgent;
      const iosDevice = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
      setIsIOS(iosDevice);

      const nav = window.navigator as NavigatorWithStandalone;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

      // If they already installed it, never show
      if (isStandalone) return;

      // Count dismissals — not days
      const dismissalCount = parseInt(localStorage.getItem('campuscheck_pwa_dismiss_count') || '0', 10);

      // After 3 dismissals, permanently stop
      if (dismissalCount >= 3) return;

      // Only show after they've demonstrated intent:
      // - Successfully checked into at least 1 class
      const checkinCount = parseInt(localStorage.getItem('campuscheck_checkin_count') || '0', 10);
      if (checkinCount < 1) return;

      // Show if enough new check-ins since their last dismissal
      const lastDismissedAt = parseInt(localStorage.getItem('campuscheck_pwa_last_dismissed_checkin_count') || '0', 10);
      const requiredCheckinsSinceDismiss = dismissalCount === 0 ? 1 : dismissalCount === 1 ? 3 : 10;

      if (checkinCount - lastDismissedAt < requiredCheckinsSinceDismiss) return;

      setShowPrompt(true);
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const handleDismiss = () => {
    const currentCheckins = parseInt(localStorage.getItem('campuscheck_checkin_count') || '0', 10);
    const currentDismissCount = parseInt(localStorage.getItem('campuscheck_pwa_dismiss_count') || '0', 10);

    localStorage.setItem('campuscheck_pwa_dismiss_count', String(currentDismissCount + 1));
    localStorage.setItem('campuscheck_pwa_last_dismissed_checkin_count', String(currentCheckins));
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 max-w-md mx-auto relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[#2563EB] p-2 rounded-lg text-white">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              {isIOS ? 'Install CampusCheck App' : 'Add CampusCheck to Home Screen'}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              {isIOS ? 'Required for reliable notifications on iPhone' : 'Faster check-ins, no browser needed'}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-700 font-medium">
          {isIOS ? (
            <>
              <p>1. Tap the <strong>Share</strong> button at the bottom of Safari <Share size={14} className="inline mx-1 text-blue-600 mb-1" /></p>
              <p>2. Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={14} className="inline mx-1 text-gray-800 mb-1" /></p>
              <p>3. Open the app from your home screen to enable instant alerts!</p>
            </>
          ) : (
            <>
              <p>1. Tap the <strong>menu icon</strong> (three dots) in Chrome.</p>
              <p>2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
              <p>3. Open from your home screen for faster access.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}