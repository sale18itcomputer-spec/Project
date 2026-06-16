'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { Square } from 'lucide-react';
import { ManagedWindow, getWindowRect, useWindowManager } from '../../contexts/WindowManagerContext';

const DOCK_Z_INDEX = 999999;

const MinimizedDock: React.FC<{ windows: ManagedWindow[] }> = ({ windows }) => {
    const { restoreWindow, focusWindow, reportGhostTarget } = useWindowManager();
    const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    useLayoutEffect(() => {
        for (const win of windows) {
            const el = chipRefs.current.get(win.id);
            if (el) {
                const r = el.getBoundingClientRect();
                reportGhostTarget(win.id, { x: r.left, y: r.top, width: r.width, height: r.height });
            }
        }
    }, [windows, reportGhostTarget]);

    const handleRestore = (win: ManagedWindow) => {
        const el = chipRefs.current.get(win.id);
        const r = el?.getBoundingClientRect();
        const fromRect = r
            ? { x: r.left, y: r.top, width: r.width, height: r.height }
            : { x: 0, y: window.innerHeight, width: 0, height: 0 };
        restoreWindow(win.id, fromRect, getWindowRect(win));
        focusWindow(win.id);
    };

    return (
        <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{ zIndex: DOCK_Z_INDEX }}
        >
            <div className="flex items-center gap-1.5 pointer-events-auto bg-card/80 backdrop-blur-md border border-border shadow-xl rounded-2xl px-3 py-2">
                {windows.map(win => (
                    <button
                        key={win.id}
                        ref={el => { if (el) chipRefs.current.set(win.id, el); else chipRefs.current.delete(win.id); }}
                        onClick={() => handleRestore(win)}
                        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                        title={`Restore ${win.title}`}
                    >
                        <Square size={13} className="text-muted-foreground shrink-0" />
                        <span className="max-w-[140px] truncate">{win.title}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MinimizedDock;
