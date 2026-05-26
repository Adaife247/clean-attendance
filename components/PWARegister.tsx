'use client';
import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('✅ PWA Engine Activated'))
        .catch((err) => console.error('⚠️ PWA Engine Failed:', err));
    }
  }, []);

  return null; 
}