'use client';
import { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Download } from 'lucide-react';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export default function PWAInstaller() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      const ua = window.navigator.userAgent;
      const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
      
      const nav = window.navigator as NavigatorWithStandalone;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

      const wasDismissed = localStorage.getItem('campuscheck_pwa_dismissed') === 'true';

      if (isIosDevice && !isStandalone && !wasDismissed) {
        setShowPrompt(true);
      }
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('campuscheck_pwa_dismissed', 'true');
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
            <h3 className="font-bold text-gray-900 text-sm">Install CampusCheck App</h3>
            <p className="text-xs text-gray-500 font-medium">Required for reliable notifications on iPhone</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-700 font-medium">
          <p>1. Tap the <strong>Share</strong> button at the bottom of Safari <Share size={14} className="inline mx-1 text-blue-600 mb-1" /></p>
          <p>2. Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={14} className="inline mx-1 text-gray-800 mb-1" /></p>
          <p>3. Open the app from your home screen to enable instant alerts!</p>
        </div>
      </div>
    </div>
  );
}