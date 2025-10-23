import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from './icons/CloseIcon';
import { Expand } from 'lucide-react';

interface ResizableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const ResizableModal: React.FC<ResizableModalProps> = ({
  isOpen,
  onClose,
  title,
  initialWidth = 896, // lg:max-w-4xl
  initialHeight = 720, // max-h-[80vh] approx
  minWidth = 400,
  minHeight = 300,
  children,
  footer,
}) => {
  const [isShowing, setIsShowing] = useState(false);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `resizable-modal-title-${React.useId()}`;
  const resizeStartRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSize({ width: initialWidth, height: initialHeight });
      const timer = setTimeout(() => setIsShowing(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsShowing(false);
    }
  }, [isOpen, initialWidth, initialHeight]);
  
  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const triggerElement = document.activeElement as HTMLElement;

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      const handleEscapeKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      firstElement?.focus();

      document.addEventListener('keydown', handleTabKey);
      document.addEventListener('keydown', handleEscapeKey);

      return () => {
        document.removeEventListener('keydown', handleTabKey);
        document.removeEventListener('keydown', handleEscapeKey);
        triggerElement?.focus();
      };
    }
  }, [isOpen, onClose]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [size.width, size.height]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing && resizeStartRef.current) {
      const dx = e.clientX - resizeStartRef.current.startX;
      const dy = e.clientY - resizeStartRef.current.startY;
      
      const newWidth = Math.max(minWidth, resizeStartRef.current.startWidth + dx);
      const newHeight = Math.max(minHeight, resizeStartRef.current.startHeight + dy);

      setSize({ width: newWidth, height: newHeight });
    }
  }, [isResizing, minWidth, minHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    resizeStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 flex justify-center items-center p-4 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={modalRef}
        style={{ width: `${size.width}px`, height: `${size.height}px` }}
        className={`relative bg-white rounded-xl shadow-xl flex flex-col transform transition-all duration-300 ease-in-out ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${isResizing ? 'transition-none' : ''}`}
        aria-labelledby={titleId}
      >
        <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm p-6 border-b border-gray-200 flex justify-between items-center z-10 rounded-t-xl">
          <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close form">
            <CloseIcon />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm pt-4 pb-4 mt-auto border-t border-gray-200 z-10 px-6 rounded-b-xl">
            {footer}
          </div>
        )}

        <div 
          onMouseDown={handleMouseDown}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-20 flex items-center justify-center text-slate-400 hover:text-slate-700"
          title="Resize modal"
        >
          <Expand className="w-4 h-4 rotate-90" />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ResizableModal;