import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function usePushNotifications(matricNumber: string) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {}
  };

  useEffect(() => {
    // Wrap in setTimeout to prevent React "setState in effect" warning
    const id = setTimeout(() => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        setIsSupported(true);
        setPermission(Notification.permission);
        checkSubscription();
      }
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const subscribe = async () => {
    if (!isSupported || !matricNumber) return;
    
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        throw new Error('Permission not granted for Notification');
      }

      const registration = await navigator.serviceWorker.ready;
      
      // 1. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
      });

      // 2. Save to Database
      const { error } = await supabase.from('push_subscriptions').upsert({
        matric_number: matricNumber.toUpperCase().trim(),
        subscription: subscription,
        created_at: new Date().toISOString()
      }, { onConflict: 'matric_number' });

      if (error) throw error;
      setIsSubscribed(true);
      
    } catch (err) {
      console.error('Failed to subscribe', err);
    }
  };

  const unsubscribe = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('matric_number', matricNumber.toUpperCase().trim());
      setIsSubscribed(false);
    }
  };

  return { isSupported, permission, isSubscribed, subscribe, unsubscribe };
}

// Helper function for VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}