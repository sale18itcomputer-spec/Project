'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useWindowManager } from '../../contexts/WindowManagerContext';
import ManagedWindowFrame from './ManagedWindowFrame';
import MinimizedDock from './MinimizedDock';
import WindowGhost from './WindowGhost';

/**
 * Single portal for every window registered via WindowManagerContext.
 * Mounted once by WindowManagerProvider — individual pages never create
 * their own portals when opted into the window manager.
 */
const WindowManagerRoot: React.FC = () => {
    const { windows, ghosts, removeGhost } = useWindowManager();

    if ((windows.length === 0 && ghosts.length === 0) || typeof document === 'undefined') return null;

    const renderable = windows.filter(w => !w.headless);
    const minimized = renderable.filter(w => w.isMinimized);
    const visibleWindows = renderable.filter(w => !w.isMinimized);
    const maxZ = visibleWindows.length > 0 ? Math.max(...visibleWindows.map(w => w.zIndex)) : -1;

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
