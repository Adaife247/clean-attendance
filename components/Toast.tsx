// components/Toast.tsx
'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastProps) {
  return (
    <div 
      className="fixed bottom-4 right-4 z-200 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage, onRemove: () => void }) {
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Accessibility Standard: Do NOT auto-dismiss errors. They require manual user action.
    if (toast.type === 'error' || isPaused) return;

    const timer = setTimeout(onRemove, 5000);
    return () => clearTimeout(timer);
  }, [toast.type, onRemove, isPaused]);

  return (
    <div 
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="pointer-events-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="shrink-0 mt-0.5">
        {toast.type === 'success' && <CheckCircle className="text-emerald-500" size={20} />}
        {toast.type === 'error' && <AlertTriangle className="text-red-500" size={20} />}
        {toast.type === 'info' && <Info className="text-blue-500" size={20} />}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{toast.title}</h4>
        {toast.description && <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{toast.description}</p>}
      </div>
      <button 
        onClick={onRemove} 
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// A simple hook to manage toasts
import { useCallback } from 'react';
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const addToast = useCallback((title: string, description?: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}