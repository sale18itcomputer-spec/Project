import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  variant?: 'danger' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = "Delete",
  variant = 'danger'
}) => {
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
      className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-[10000] flex justify-center items-center p-4 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`relative bg-card rounded-xl shadow-xl w-full max-w-md border border-border transform transition-all duration-300 ease-in-out ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${variant === 'danger' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
              <AlertTriangle className={`h-6 w-6 ${variant === 'danger' ? 'text-rose-500' : 'text-amber-500'}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold leading-6 text-foreground" id="modal-title">
                {title}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {children}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-muted/30 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 rounded-b-xl border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto justify-center rounded-md bg-transparent px-4 py-2 text-sm font-semibold text-foreground border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationModal;
