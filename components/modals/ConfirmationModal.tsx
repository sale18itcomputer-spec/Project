'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = "Delete",
  variant = 'danger',
  isLoading = false
}) => {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay for enter animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsShowing(true));
      });
    } else {
      setIsShowing(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex justify-center items-center p-4 transition-all duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={isLoading ? undefined : onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      {/* Glass morphism backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div
        className={`relative bg-card rounded-xl shadow-2xl w-full max-w-md border border-border transform transition-all duration-300 ease-out ${isShowing ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full transition-all duration-300 ${isShowing ? 'scale-100' : 'scale-0'} ${variant === 'danger' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
              <AlertTriangle className={`h-6 w-6 ${variant === 'danger' ? 'text-rose-500' : 'text-amber-500'} ${isShowing ? 'animate-[check-bounce_0.4s_ease-out]' : ''}`} />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-lg font-semibold leading-6 text-foreground" id="modal-title">
                {title}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {children}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-muted/30 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 rounded-b-xl border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto justify-center rounded-lg bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground border border-border hover:bg-muted transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/20' : 'bg-amber-600 hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/20'}`}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationModal;

