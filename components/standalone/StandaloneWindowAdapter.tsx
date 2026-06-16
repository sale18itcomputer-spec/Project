'use client';

import React, { useEffect } from 'react';
import { useWindowManager } from '@/contexts/WindowManagerContext';

interface Props {
    windowId: string;
    children: React.ReactNode;
}

/**
 * Registers a headless window so WindowContent components can call
 * updateWindow(footer) and closeWindow() normally. Renders the captured
 * footer at the bottom of the standalone page, and calls window.close()
 * when the content triggers closeWindow.
 */
export default function StandaloneWindowAdapter({ windowId, children }: Props) {
    const { openWindow, windows } = useWindowManager();

    useEffect(() => {
        openWindow({ id: windowId, title: '', content: null, headless: true,
            initialWidth: 0, initialHeight: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId]);

    const win = windows.find(w => w.id === windowId);

    useEffect(() => {
        if (win?.isClosing) window.close();
    }, [win?.isClosing]);

    return (
        <div className="h-screen flex flex-col bg-background">
            <div className="flex-1 min-h-0 overflow-y-auto">
                {children}
            </div>
            {win?.footer && (
                <div className="flex-shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-6 py-4">
                    {win.footer}
                </div>
            )}
        </div>
    );
}
