'use client';

import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { Expand, Minus, X } from 'lucide-react';
import { ManagedWindow, SnapZone, useWindowManager } from '../../contexts/WindowManagerContext';

const SNAP_MARGIN = 24;

/**
 * Chrome (title bar, drag/resize/snap, content + footer areas) for a single
 * managed window. Rendered by WindowManagerRoot inside its single portal —
 * adapted from ResizableModal's drag/resize/snap logic, but driven by
 * WindowManagerContext state instead of local component state.
 */
const ManagedWindowFrame: React.FC<{ win: ManagedWindow }> = React.memo(({ win }) => {
    const { updateWindow, closeWindow, minimizeWindow, focusWindow } = useWindowManager();

    const [isShowing, setIsShowing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [snapPreview, setSnapPreview] = useState<SnapZone>(null);

    const titleId = `managed-window-title-${useId()}`;
    const dragStartRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
    const resizeStartRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setIsShowing(true), 10);
        return () => clearTimeout(timer);
    }, []);

    // ── Resize ──────────────────────────────────────────────────────────────
    const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        focusWindow(win.id);
        setIsResizing(true);
        resizeStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWidth: win.rect.width,
            startHeight: win.rect.height,
        };
    }, [win.id, win.rect.width, win.rect.height, focusWindow]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !resizeStartRef.current) return;
        const dx = e.clientX - resizeStartRef.current.startX;
        const dy = e.clientY - resizeStartRef.current.startY;
        const newWidth = Math.max(win.minWidth, resizeStartRef.current.startWidth + dx);
        const newHeight = Math.max(win.minHeight, resizeStartRef.current.startHeight + dy);
        updateWindow(win.id, { rect: { ...win.rect, width: newWidth, height: newHeight } });
    }, [isResizing, win.id, win.rect, win.minWidth, win.minHeight, updateWindow]);

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
        resizeStartRef.current = null;
    }, []);

    useEffect(() => {
        if (isResizing) {
            document.body.style.cursor = 'nwse-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
        }
        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    // ── Drag + edge snapping ───────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!win.draggable) return;
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        focusWindow(win.id);
        if (win.snapped) updateWindow(win.id, { snapped: null });
        setIsDragging(true);
        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: win.rect.x,
            startTop: win.rect.y,
        };
    }, [win.draggable, win.snapped, win.id, win.rect.x, win.rect.y, focusWindow, updateWindow]);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;
        updateWindow(win.id, {
            rect: { ...win.rect, x: dragStartRef.current.startLeft + dx, y: dragStartRef.current.startTop + dy },
        });

        let zone: SnapZone = null;
        if (e.clientY <= SNAP_MARGIN) zone = 'maximize';
        else if (e.clientX <= SNAP_MARGIN) zone = 'left';
        else if (e.clientX >= window.innerWidth - SNAP_MARGIN) zone = 'right';
        setSnapPreview(zone);
    }, [isDragging, win.id, win.rect, updateWindow]);

    const handleDragEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);
        if (snapPreview) updateWindow(win.id, { snapped: snapPreview });
        setSnapPreview(null);
        dragStartRef.current = null;
    }, [isDragging, snapPreview, win.id, updateWindow]);

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

    const frameStyle: React.CSSProperties =
        win.snapped === 'maximize' ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }
        : win.snapped === 'left' ? { position: 'fixed', top: 0, left: 0, width: '50vw', height: '100vh' }
        : win.snapped === 'right' ? { position: 'fixed', top: 0, left: '50vw', width: '50vw', height: '100vh' }
        : { position: 'fixed', top: win.rect.y, left: win.rect.x, width: win.rect.width, height: win.rect.height };

    const snapPreviewRect: React.CSSProperties | null =
        snapPreview === 'maximize' ? { top: 0, left: 0, width: '100vw', height: '100vh' }
        : snapPreview === 'left' ? { top: 0, left: 0, width: '50vw', height: '100vh' }
        : snapPreview === 'right' ? { top: 0, left: '50vw', width: '50vw', height: '100vh' }
        : null;

    return (
        <>
            {snapPreviewRect && (
                <div
                    className="fixed bg-primary/20 border-2 border-primary rounded-lg pointer-events-none transition-all duration-150"
                    style={{ ...snapPreviewRect, zIndex: win.zIndex + 1 }}
                />
            )}
            <div
                style={{ ...frameStyle, zIndex: win.zIndex }}
                onMouseDown={() => focusWindow(win.id)}
                className={`bg-card rounded-xl shadow-2xl flex flex-col border border-border ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${isDragging || isResizing ? 'transition-none' : 'transition-all duration-200'}`}
                aria-labelledby={titleId}
                role="dialog"
            >
                <div
                    onMouseDown={handleDragStart}
                    className={`flex-shrink-0 bg-card/80 backdrop-blur-md p-4 flex justify-between items-center rounded-t-xl border-b border-border ${win.draggable ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
                >
                    <h2 id={titleId} className="text-base font-bold text-foreground truncate">{win.title}</h2>
                    <div className="flex items-center gap-1">
                        <button onClick={() => minimizeWindow(win.id)} className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Minimize" title="Minimize">
                            <Minus size={16} />
                        </button>
                        <button onClick={() => { closeWindow(win.id); win.onClose(); }} className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Close" title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
                    {win.content}
                </div>

                {win.footer && (
                    <div className="flex-shrink-0 bg-card/80 backdrop-blur-md pt-4 pb-4 border-t border-border px-6 rounded-b-xl">
                        {win.footer}
                    </div>
                )}

                {!win.snapped && (
                    <div
                        onMouseDown={handleResizeStart}
                        className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-muted-foreground/40 hover:text-foreground transition-colors"
                        title="Resize"
                    >
                        <Expand className="w-4 h-4 rotate-90" />
                    </div>
                )}
            </div>
        </>
    );
});

export default ManagedWindowFrame;
