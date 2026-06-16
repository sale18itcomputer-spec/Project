'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWindowManager } from '../../contexts/WindowManagerContext';
import ManagedWindowFrame from './ManagedWindowFrame';
import MinimizedDock from './MinimizedDock';
import WindowGhost from './WindowGhost';

const WindowManagerRoot: React.FC = () => {
    const { windows, ghosts, removeGhost, focusWindow, restoreWindow } = useWindowManager();

    const renderable = windows.filter(w => !w.headless);
    const minimized = renderable.filter(w => w.isMinimized);
    const visibleWindows = renderable.filter(w => !w.isMinimized);
    const maxZ = visibleWindows.length > 0 ? Math.max(...visibleWindows.map(w => w.zIndex)) : -1;

    // Alt+` cycles focus through open (non-minimized) windows
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!e.altKey || e.code !== 'Backquote') return;
            const targets = renderable.filter(w => !w.isMinimized);
            if (targets.length < 2) return;
            e.preventDefault();
            const sorted = [...targets].sort((a, b) => a.zIndex - b.zIndex);
            // The focused window is the last in sorted order; next = first
            const next = e.shiftKey ? sorted[sorted.length - 1] : sorted[0];
            focusWindow(next.id);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renderable, focusWindow]);

    if ((windows.length === 0 && ghosts.length === 0) || typeof document === 'undefined') return null;

    return createPortal(
        <>
            {renderable.map(win => (
                <ManagedWindowFrame key={win.id} win={win} isFocused={!win.isMinimized && win.zIndex === maxZ} />
            ))}
            {minimized.length > 0 && <MinimizedDock windows={minimized} />}
            {ghosts.map(ghost => (
                <WindowGhost key={ghost.ghostId} ghost={ghost} onDone={removeGhost} />
            ))}
        </>,
        document.body
    );
};

export default WindowManagerRoot;
