'use client';

import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { Minus, X, ExternalLink } from 'lucide-react';
import { ManagedWindow, SnapZone, useWindowManager } from '../../contexts/WindowManagerContext';

const SNAP_MARGIN = 24;

/**
 * Chrome (title bar, drag/resize/snap, content + footer areas) for a single
 * managed window. Rendered by WindowManagerRoot inside its single portal —
 * adapted from ResizableModal's drag/resize/snap logic, but driven by
 * WindowManagerContext state instead of local component state.
 */
const ManagedWindowFrame: React.FC<{ win: ManagedWindow; isFocused: boolean }> = React.memo(({ win, isFocused }) => {
    const { updateWindow, closeWindow, removeWindow, minimizeWindow, focusWindow } = useWindowManager();

    const [isShowing, setIsShowing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDir, setResizeDir] = useState<string | null>(null);
    const [snapPreview, setSnapPreview] = useState<SnapZone>(null);

    const titleId = `managed-window-title-${useId()}`;
    const frameRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
    const resizeStartRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; startLeft: number; startTop: number } | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setIsShowing(true), 10);
        return () => clearTimeout(timer);
    }, []);

    // Play the same fade/scale transition in reverse, then unmount once it finishes.
    useEffect(() => {
        if (!win.isClosing) return;
        setIsShowing(false);
        const timer = setTimeout(() => removeWindow(win.id), 200);
        return () => clearTimeout(timer);
    }, [win.isClosing, win.id, removeWindow]);

    // ── Resize ──────────────────────────────────────────────────────────────
    const handleResizeStart = useCallback((dir: string) => (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        focusWindow(win.id);
        setIsResizing(true);
        setResizeDir(dir);
        resizeStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWidth: win.rect.width,
            startHeight: win.rect.height,
            startLeft: win.rect.x,
            startTop: win.rect.y,
        };
    }, [win.id, win.rect, focusWindow]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !resizeStartRef.current || !resizeDir) return;
        const dx = e.clientX - resizeStartRef.current.startX;
        const dy = e.clientY - resizeStartRef.current.startY;
        const { startWidth, startHeight, startLeft, startTop } = resizeStartRef.current;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startLeft;
        let newY = startTop;

        if (resizeDir.includes('e')) newWidth = Math.max(win.minWidth, startWidth + dx);
        if (resizeDir.includes('s')) newHeight = Math.max(win.minHeight, startHeight + dy);
        if (resizeDir.includes('w')) {
            newWidth = Math.max(win.minWidth, startWidth - dx);
            newX = startLeft + (startWidth - newWidth);
        }
        if (resizeDir.includes('n')) {
            newHeight = Math.max(win.minHeight, startHeight - dy);
            newY = startTop + (startHeight - newHeight);
        }

        updateWindow(win.id, { rect: { x: newX, y: newY, width: newWidth, height: newHeight } });
    }, [isResizing, resizeDir, win.id, win.minWidth, win.minHeight, updateWindow]);

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
        setResizeDir(null);
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
                ref={frameRef}
                style={{ ...frameStyle, zIndex: win.zIndex, display: win.isMinimized ? 'none' : undefined }}
                onMouseDown={() => focusWindow(win.id)}
                className={`window-frame-glow ${isFocused ? 'window-focused' : ''} bg-card rounded-xl shadow-2xl flex flex-col ${isShowing ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${isDragging || isResizing ? 'transition-none' : 'transition-all duration-200'}`}
                aria-labelledby={titleId}
                role="dialog"
            >
                <div
                    onMouseDown={handleDragStart}
                    className={`flex-shrink-0 bg-card/80 backdrop-blur-sm p-4 flex justify-between items-center rounded-t-xl border-b border-border ${win.draggable ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
                >
                    <h2 id={titleId} className="text-base font-bold text-foreground truncate">{win.title}</h2>
                    <div className="flex items-center gap-1">
                        {win.detachUrl && (
                            <button
                                onClick={() => {
                                    const rect = frameRef.current?.getBoundingClientRect();
                                    const left = Math.round(rect?.left ?? win.rect.x) + window.screenX;
                                    const top  = Math.round(rect?.top  ?? win.rect.y) + window.screenY;
                                    const w    = Math.round(win.rect.width);
                                    const h    = Math.round(win.rect.height);
                                    window.open(
                                        win.detachUrl,
                                        `pip-${win.id}`,
                                        `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no`,
                                    );
                                }}
                                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                aria-label="Pop out"
                                title="Pop out to floating window"
                            >
                                <ExternalLink size={14} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                const r = frameRef.current?.getBoundingClientRect();
                                minimizeWindow(win.id, r
                                    ? { x: r.left, y: r.top, width: r.width, height: r.height }
                                    : { x: win.rect.x, y: win.rect.y, width: win.rect.width, height: win.rect.height });
                            }}
                            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Minimize" title="Minimize"
                        >
                            <Minus size={16} />
                        </button>
                        <button onClick={() => { win.onClose(); closeWindow(win.id); }} className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Close" title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className={`@container flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border ${win.noPadding ? 'p-0' : 'p-6'}`}>
                    {win.content}
                </div>

                {win.footer && (
                    <div className="flex-shrink-0 bg-card/80 backdrop-blur-sm pt-4 pb-4 border-t border-border px-6 rounded-b-xl">
                        {win.footer}
                    </div>
                )}

                {!win.snapped && (
                    <>
                        {/* Edge handles */}
                        <div onMouseDown={handleResizeStart('n')}  className="absolute top-0 left-2 right-2 h-1 cursor-n-resize" />
                        <div onMouseDown={handleResizeStart('s')}  className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize" />
                        <div onMouseDown={handleResizeStart('e')}  className="absolute top-2 bottom-2 right-0 w-1 cursor-e-resize" />
                        <div onMouseDown={handleResizeStart('w')}  className="absolute top-2 bottom-2 left-0 w-1 cursor-w-resize" />
                        {/* Corner handles */}
                        <div onMouseDown={handleResizeStart('nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" />
                        <div onMouseDown={handleResizeStart('ne')} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" />
                        <div onMouseDown={handleResizeStart('sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
                        <div onMouseDown={handleResizeStart('se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" />
                    </>
                )}
            </div>
        </>
    );
});

export default ManagedWindowFrame;
