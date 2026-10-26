'use client';

import { AlertTriangle, Info, X } from 'lucide-react';
import { ReactNode, useState, useCallback } from 'react';

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
      className="fixed inset-0 bg-gray-900/60 z-100 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center relative">
          <button
            onClick={handleCancel}
            aria-label="Close dialog"
            className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {danger ? <AlertTriangle size={32} /> : <Info size={32} />}
          </div>
          <h3
            id="confirm-modal-title"
            className="text-xl font-extrabold text-gray-900 mb-2"
          >
            {config.title}
          </h3>
          <div
            id="confirm-modal-message"
            className="text-sm text-gray-500 font-medium leading-relaxed"
          >
            {config.message}
          </div>
        </div>
        <div className="p-4 bg-gray-50 flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-100 transition-all text-sm"
          >
            {config.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 font-bold py-3 rounded-xl text-sm shadow-md transition-all ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#2563EB] text-white hover:bg-blue-700'
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