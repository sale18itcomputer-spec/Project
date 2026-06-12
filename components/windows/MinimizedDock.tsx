'use client';

import React from 'react';
import { Square } from 'lucide-react';
import { ManagedWindow, useWindowManager } from '../../contexts/WindowManagerContext';

const DOCK_Z_INDEX = 999999;

/**
 * Single taskbar-style dock listing every minimized window across the app.
 * Rendered once by WindowManagerRoot alongside the visible window frames.
 */
const MinimizedDock: React.FC<{ windows: ManagedWindow[] }> = ({ windows }) => {
    const { restoreWindow, focusWindow } = useWindowManager();

    const handleRestore = (id: string) => {
        restoreWindow(id);
        focusWindow(id);
    };

    return (
        <div
            className="fixed bottom-0 left-0 right-0 flex items-center gap-2 p-2 pointer-events-none"
            style={{ zIndex: DOCK_Z_INDEX }}
        >
            <div className="flex items-center gap-2 overflow-x-auto pointer-events-auto">
                {windows.map(win => (
                    <button
                        key={win.id}
                        onClick={() => handleRestore(win.id)}
                        className="flex items-center gap-2 bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                        title={`Restore ${win.title}`}
                    >
                        <Square size={14} className="text-muted-foreground" />
                        {win.title}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MinimizedDock;
