'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, X, ExternalLink, ArrowRight } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  actionButtonText?: string;
  onAction?: () => void;
  actionButtonLink?: string | null;
  extraActions?: React.ReactNode;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  actionButtonText = "Done",
  onAction,
  actionButtonLink,
  extraActions
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !isVisible) return null;

  return (
    <div className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Professional Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className={`
                relative w-full max-w-md bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden transform transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-4 scale-[0.97] opacity-0'}
            `}>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all z-10"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>

        <div className="relative p-8 flex flex-col items-center text-center">
          {/* Professional Icon Layout */}
          <div className="mb-6 flex items-center justify-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100/50 relative">
              <div className="absolute inset-0 bg-emerald-400/10 rounded-2xl animate-pulse" />
              <CheckCircle2 className="w-8 h-8 text-emerald-600 relative z-10" strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
            {title}
          </h2>

          <div className="text-sm text-slate-500 font-medium leading-relaxed mb-10 max-w-[280px]">
            {message}
          </div>

          <div className="w-full space-y-2.5">
            {actionButtonLink ? (
              <a
                href={actionButtonLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white h-11 rounded-xl font-bold hover:bg-brand-700 transition-all active:scale-[0.98] shadow-sm"
              >
                {actionButtonText}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                onClick={onAction || onClose}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white h-11 rounded-xl font-bold hover:bg-brand-700 transition-all active:scale-[0.98] shadow-sm"
              >
                {actionButtonText}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {extraActions && (
              <div className="pt-2 w-full animate-in fade-in slide-in-from-top-1 duration-500">
                {extraActions}
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-blue-500/50 opacity-40" />
      </div>
    </div>
  );
};

export default SuccessModal;

