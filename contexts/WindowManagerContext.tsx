'use client';

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

export type SnapZone = 'left' | 'right' | 'maximize' | null;

export interface WindowRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ManagedWindow {
    id: string;
    title: string;
    content: ReactNode;
    footer?: ReactNode;
    draggable: boolean;
    isMinimized: boolean;
    isClosing: boolean;
    rect: WindowRect;
    snapped: SnapZone;
    zIndex: number;
    minWidth: number;
    minHeight: number;
    onClose: () => void;
    noPadding?: boolean;
    detachUrl?: string;
    headless?: boolean;
}

export interface OpenWindowInput {
    id: string;
    title: string;
    content: ReactNode;
    footer?: ReactNode;
    draggable?: boolean;
    onClose?: () => void;
    minWidth?: number;
    minHeight?: number;
    initialWidth?: number;
    initialHeight?: number;
    noPadding?: boolean;
    detachUrl?: string;
    headless?: boolean;
}

/** A short-lived "flying" placeholder animated (FLIP-style) between a window frame's
 *  rect and its minimized-dock chip's rect, in either direction. */
export interface GhostAnimation {
    ghostId: string;
    windowId: string;
    kind: 'minimize' | 'restore';
    fromRect: WindowRect;
    toRect: WindowRect | null;
}

type ManagedWindowPatch = Partial<Pick<ManagedWindow, 'title' | 'content' | 'footer' | 'rect' | 'snapped' | 'isMinimized'>>;

interface WindowManagerContextValue {
    windows: ManagedWindow[];
    ghosts: GhostAnimation[];
    openWindow: (input: OpenWindowInput) => void;
    closeWindow: (id: string) => void;
    removeWindow: (id: string) => void;
    updateWindow: (id: string, patch: ManagedWindowPatch) => void;
    minimizeWindow: (id: string, fromRect: WindowRect) => void;
    restoreWindow: (id: string, fromRect: WindowRect, toRect: WindowRect) => void;
    reportGhostTarget: (windowId: string, rect: WindowRect) => void;
    removeGhost: (ghostId: string) => void;
    focusWindow: (id: string) => void;
}

const WindowManagerContext = createContext<WindowManagerContextValue | undefined>(undefined);

const DEFAULT_WIDTH = 896;
const DEFAULT_HEIGHT = 720;
const CASCADE_OFFSET = 32;
const CASCADE_SLOTS = 6;
const BASE_Z_INDEX = 10000;

/** A window's currently-rendered rect, accounting for edge-snapped (maximize/left/right) layouts. */
export const getWindowRect = (win: ManagedWindow): WindowRect => {
    if (typeof window === 'undefined') return win.rect;
    switch (win.snapped) {
        case 'maximize': return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
        case 'left': return { x: 0, y: 0, width: window.innerWidth / 2, height: window.innerHeight };
        case 'right': return { x: window.innerWidth / 2, y: 0, width: window.innerWidth / 2, height: window.innerHeight };
        default: return win.rect;
    }
};

export const WindowManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [windows, setWindows] = useState<ManagedWindow[]>([]);
    const [ghosts, setGhosts] = useState<GhostAnimation[]>([]);
    const zCounterRef = useRef(BASE_Z_INDEX);
    const ghostCounterRef = useRef(0);

    const openWindow = useCallback((input: OpenWindowInput) => {
        setWindows(prev => {
            const existing = prev.find(w => w.id === input.id);
            if (existing) {
                return prev.map(w => w.id === input.id
                    ? {
                        ...w,
                        title: input.title,
                        content: input.content,
                        footer: input.footer,
                        onClose: input.onClose ?? w.onClose,
                        isMinimized: false,
                        isClosing: false,
                        zIndex: ++zCounterRef.current,
                    }
                    : w);
            }

            const width = input.initialWidth ?? DEFAULT_WIDTH;
            const height = input.initialHeight ?? DEFAULT_HEIGHT;
            const cascade = (prev.length % CASCADE_SLOTS) * CASCADE_OFFSET;
            const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
            const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

            const win: ManagedWindow = {
                id: input.id,
                title: input.title,
                content: input.content,
                footer: input.footer,
                draggable: input.draggable ?? true,
                isMinimized: false,
                isClosing: false,
                rect: {
                    x: Math.max(16, (viewportWidth - width) / 2) + cascade,
                    y: Math.max(16, (viewportHeight - height) / 2) + cascade,
                    width,
                    height,
                },
                snapped: null,
                zIndex: ++zCounterRef.current,
                minWidth: input.minWidth ?? 400,
                minHeight: input.minHeight ?? 300,
                onClose: input.onClose ?? (() => {}),
                noPadding: input.noPadding,
                detachUrl: input.detachUrl,
                headless: input.headless,
            };
            return [...prev, win];
        });
    }, []);

    // Marks the window for its exit (fade/scale-out) animation; the frame removes
    // itself from state via removeWindow once that animation finishes.
    const closeWindow = useCallback((id: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, isClosing: true } : w));
    }, []);

    const removeWindow = useCallback((id: string) => {
        setWindows(prev => prev.filter(w => w.id !== id));
        setGhosts(prev => prev.filter(g => g.windowId !== id));
    }, []);

    const updateWindow = useCallback((id: string, patch: ManagedWindowPatch) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
    }, []);

    const minimizeWindow = useCallback((id: string, fromRect: WindowRect) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
        setGhosts(prev => [...prev, {
            ghostId: `ghost-${++ghostCounterRef.current}`,
            windowId: id,
            kind: 'minimize',
            fromRect,
            toRect: null,
        }]);
    }, []);

    const restoreWindow = useCallback((id: string, fromRect: WindowRect, toRect: WindowRect) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: ++zCounterRef.current } : w));
        setGhosts(prev => [...prev, {
            ghostId: `ghost-${++ghostCounterRef.current}`,
            windowId: id,
            kind: 'restore',
            fromRect,
            toRect,
        }]);
    }, []);

    // Fills in the dock chip's rect once it has rendered, letting the minimize
    // ghost (created before the chip existed) know where to animate toward.
    const reportGhostTarget = useCallback((windowId: string, rect: WindowRect) => {
        setGhosts(prev => {
            const idx = prev.findIndex(g => g.windowId === windowId && g.kind === 'minimize' && g.toRect === null);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], toRect: rect };
            return next;
        });
    }, []);

    const removeGhost = useCallback((ghostId: string) => {
        setGhosts(prev => prev.filter(g => g.ghostId !== ghostId));
    }, []);

    const focusWindow = useCallback((id: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: ++zCounterRef.current } : w));
    }, []);

    const value: WindowManagerContextValue = {
        windows, ghosts, openWindow, closeWindow, removeWindow, updateWindow, minimizeWindow, restoreWindow, reportGhostTarget, removeGhost, focusWindow,
    };

    return (
        <WindowManagerContext.Provider value={value}>
            {children}
        </WindowManagerContext.Provider>
    );
};

const NOOP_CONTEXT: WindowManagerContextValue = {
    windows: [],
    ghosts: [],
    openWindow: () => {},
    closeWindow: () => {},
    removeWindow: () => {},
    updateWindow: () => {},
    minimizeWindow: () => {},
    restoreWindow: () => {},
    reportGhostTarget: () => {},
    removeGhost: () => {},
    focusWindow: () => {},
};

export const useWindowManager = (): WindowManagerContextValue => {
    const context = useContext(WindowManagerContext);
    // Trees without WindowManagerProvider (e.g. the miniapp) get a safe no-op.
    return context ?? NOOP_CONTEXT;
};
