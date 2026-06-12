'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useWindowManager } from '../../contexts/WindowManagerContext';
import ManagedWindowFrame from './ManagedWindowFrame';
import MinimizedDock from './MinimizedDock';

/**
 * Single portal for every window registered via WindowManagerContext.
 * Mounted once by WindowManagerProvider — individual pages never create
 * their own portals when opted into the window manager.
 */
const WindowManagerRoot: React.FC = () => {
    const { windows } = useWindowManager();

    if (windows.length === 0 || typeof document === 'undefined') return null;

    const visible = windows.filter(w => !w.isMinimized);
    const minimized = windows.filter(w => w.isMinimized);

    return createPortal(
        <>
            {visible.map(win => (
                <ManagedWindowFrame key={win.id} win={win} />
            ))}
            {minimized.length > 0 && <MinimizedDock windows={minimized} />}
        </>,
        document.body
    );
};

export default WindowManagerRoot;
