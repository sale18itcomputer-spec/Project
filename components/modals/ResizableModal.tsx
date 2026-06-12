'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Minus, Square, X } from 'lucide-react';

type SnapZone = 'left' | 'right' | 'maximize' | null;

const SNAP_MARGIN = 24;

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
  zIndex?: number;
  /**
   * Enables dragging the modal by its title bar, plus Aero-Snap-style edge
   * snapping: dropping the title bar near the left/right screen edge snaps
   * the modal to that half, dropping near the top edge maximizes it.
   * Dragging a snapped modal away restores it to its free size/position.
   * Off by default so existing modals are unaffected.
   */
  draggable?: boolean;
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
  zIndex,
  draggable = false,
}) => {
  const [isShowing, setIsShowing] = useState(false);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snapped, setSnapped] = useState<SnapZone>(null);
  const [snapPreview, setSnapPreview] = useState<SnapZone>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [minimizedRect, setMinimizedRect] = useState<{ x: number; y: number; width: number } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `resizable-modal-title-${React.useId()}`;
  const resizeStartRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSize({ width: initialWidth, height: initialHeight });
      setPosition(null);
      setSnapped(null);
      setSnapPreview(null);
      setIsMinimized(false);
      setMinimizedRect(null);
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

  // ── Resize ──────────────────────────────────────────────────────────────
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

  // ── Drag + edge snapping ──────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggable || isMinimized) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;

    e.preventDefault();
    setSnapped(null);
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    setPosition({ x: rect.left, y: rect.top });
  }, [draggable, isMinimized]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPosition({ x: dragStartRef.current.startLeft + dx, y: dragStartRef.current.startTop + dy });

    let zone: SnapZone = null;
    if (e.clientY <= SNAP_MARGIN) zone = 'maximize';
    else if (e.clientX <= SNAP_MARGIN) zone = 'left';
    else if (e.clientX >= window.innerWidth - SNAP_MARGIN) zone = 'right';
    setSnapPreview(zone);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (snapPreview) setSnapped(snapPreview);
    setSnapPreview(null);
    dragStartRef.current = null;
  }, [isDragging, snapPreview]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ── Minimize ───────────────────────────────────────────────────────────
  const handleToggleMinimize = useCallback(() => {
    if (!isMinimized) {
      const rect = modalRef.current?.getBoundingClientRect();
      if (rect) setMinimizedRect({ x: rect.left, y: rect.top, width: rect.width });
    }
    setIsMinimized((m) => !m);
  }, [isMinimized]);

  if (!isOpen) return null;
  const overlayZIndex = zIndex ?? 9999;

  const modalStyle: React.CSSProperties =
    isMinimized && minimizedRect ? { position: 'fixed', top: minimizedRect.y, left: minimizedRect.x, width: minimizedRect.width, height: 'auto', maxWidth: 'none', maxHeight: 'none' }
    : snapped === 'maximize' ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' }
    : snapped === 'left' ? { position: 'fixed', top: 0, left: 0, width: '50vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' }
    : snapped === 'right' ? { position: 'fixed', top: 0, left: '50vw', width: '50vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' }
    : position ? { position: 'fixed', top: position.y, left: position.x, width: size.width, height: size.height }
    : { width: size.width, height: size.height };

  const snapPreviewRect: React.CSSProperties | null =
    snapPreview === 'maximize' ? { top: 0, left: 0, width: '100vw', height: '100vh' }
    : snapPreview === 'left' ? { top: 0, left: 0, width: '50vw', height: '100vh' }
    : snapPreview === 'right' ? { top: 0, left: '50vw', width: '50vw', height: '100vh' }
    : null;

  return createPortal(
    <div
      style={{ zIndex: overlayZIndex }}
      className={`fixed inset-0 flex justify-center items-center p-4 transition-opacity duration-300 ${draggable ? '' : 'bg-black/60 backdrop-blur-sm'} ${isShowing ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${draggable && isShowing ? 'pointer-events-none' : ''}`}
      aria-modal="true"
      role="dialog"
    >
      {snapPreviewRect && (
        <div
          className="fixed bg-primary/20 border-2 border-primary rounded-lg pointer-events-none transition-all duration-150"
          style={{ ...snapPreviewRect, zIndex: overlayZIndex + 1 }}
        />
      )}
      <div
        ref={modalRef}
        style={modalStyle}
        className={`relative bg-card rounded-xl shadow-2xl flex flex-col ease-in-out border border-border pointer-events-auto ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${isResizing || isDragging ? 'transition-none' : 'transition-all duration-300'}`}
        aria-labelledby={titleId}
      >
        <div
          onMouseDown={handleDragStart}
          className={`flex-shrink-0 bg-card/80 backdrop-blur-md p-6 flex justify-between items-center z-10 rounded-t-xl ${isMinimized ? 'rounded-b-xl' : 'border-b border-border'} ${draggable ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
        >
          <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h2>
          <div className="flex items-center gap-1">
            {draggable && (
              <button onClick={handleToggleMinimize} className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200" aria-label={isMinimized ? 'Restore' : 'Minimize'} title={isMinimized ? 'Restore' : 'Minimize'}>
                {isMinimized ? <Square size={16} /> : <Minus size={20} />}
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200" aria-label="Close form">
              <X size={24} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
              {children}
            </div>

            {footer && (
              <div className="flex-shrink-0 bg-card/80 backdrop-blur-md pt-4 pb-4 mt-auto border-t border-border z-10 px-6 rounded-b-xl">
                {footer}
              </div>
            )}
          </>
        )}

        {!snapped && !isMinimized && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize z-20 flex items-center justify-center text-muted-foreground/40 hover:text-foreground transition-colors"
            title="Resize modal"
          >
            <Expand className="w-4 h-4 rotate-90" />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ResizableModal;
