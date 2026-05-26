'use client';
import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // Check if the browser supports Service Workers
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('✅ PWA Engine Activated'))
        .catch((err) => console.error('⚠️ PWA Engine Failed:', err));
    }
  }, []);

  return null; // This component is invisible
}