import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, ExternalLink } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  actionButtonLink?: string | null;
  actionButtonText?: string;
  onAction?: () => void;
  extraActions?: React.ReactNode;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, title, message, actionButtonLink, actionButtonText = "View", onAction, extraActions }) => {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300 screen-only ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`relative bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out text-center p-8 ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="mt-4">
          <h3 className="text-xl font-semibold leading-6 text-gray-900" id="modal-title">
            {title}
          </h3>
          <div className="mt-2">
            <div className="text-sm text-gray-500">
              {message}
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row-reverse gap-3">
          {actionButtonLink ? (
            <a
              href={actionButtonLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full sm:w-auto flex-1 justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {actionButtonText}
            </a>
          ) : onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="w-full sm:w-auto flex-1 justify-center rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors flex items-center gap-2"
            >
              {actionButtonText}
            </button>
          ) : null}
          {extraActions && (
            <div className="w-full sm:w-auto flex-1">
              {extraActions}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex-1 justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SuccessModal;