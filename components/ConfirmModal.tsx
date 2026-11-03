'use client';

import { AlertTriangle, Info, X } from 'lucide-react';
import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmModalProps {
  config: ConfirmModalConfig;
  onClose: () => void;
}

export function ConfirmModal({ config, onClose }: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Trap focus and handle Escape key
  useEffect(() => {
    if (!config.isOpen) return;

    // Focus the cancel button when opened (safer than focusing destructive action)
    const focusTimer = setTimeout(() => cancelBtnRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        config.onCancel?.();
      }
      
      // Basic focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [config.isOpen, config, onClose]);

  if (!config.isOpen) return null;

  const handleConfirm = () => {
    onClose();
    config.onConfirm();
  };

  const handleCancel = () => {
    onClose();
    config.onCancel?.();
  };

  const danger = config.isDangerous ?? true;

  return (
    <div
      className="fixed inset-0 bg-gray-900/60 dark:bg-black/80 z-100 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      onClick={handleCancel}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center relative">
          <button
            onClick={handleCancel}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <X size={20} />
          </button>
          
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              danger ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}
          >
            {danger ? <AlertTriangle size={32} /> : <Info size={32} />}
          </div>
          <h3
            id="confirm-modal-title"
            className="text-xl font-extrabold text-gray-900 dark:text-white mb-2"
          >
            {config.title}
          </h3>
          <div
            id="confirm-modal-message"
            className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed"
          >
            {config.message}
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
          <button
            ref={cancelBtnRef}
            onClick={handleCancel}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {config.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 font-bold py-3 rounded-xl text-sm shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 dark:focus-visible:ring-offset-gray-900'
                : 'bg-[#2563EB] text-white hover:bg-blue-700 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-gray-900'
            }`}
          >
            {config.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmModal() {
  const [config, setConfig] = useState<ConfirmModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDangerous: true,
  });

  const ask = useCallback(
    (
      title: string,
      message: string | ReactNode,
      onConfirm: () => void,
      options?: { isDangerous?: boolean; confirmLabel?: string }
    ) => {
      setConfig({
        isOpen: true,
        title,
        message,
        onConfirm,
        isDangerous: options?.isDangerous ?? true,
        confirmLabel: options?.confirmLabel,
      });
    },
    []
  );

  const close = useCallback(() => {
    setConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { config, ask, close };
}