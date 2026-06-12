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
    rect: WindowRect;
    snapped: SnapZone;
    zIndex: number;
    minWidth: number;
    minHeight: number;
    onClose: () => void;
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
}

type ManagedWindowPatch = Partial<Pick<ManagedWindow, 'title' | 'content' | 'footer' | 'rect' | 'snapped' | 'isMinimized'>>;

interface WindowManagerContextValue {
    windows: ManagedWindow[];
    openWindow: (input: OpenWindowInput) => void;
    closeWindow: (id: string) => void;
    updateWindow: (id: string, patch: ManagedWindowPatch) => void;
    minimizeWindow: (id: string) => void;
    restoreWindow: (id: string) => void;
    focusWindow: (id: string) => void;
}

const WindowManagerContext = createContext<WindowManagerContextValue | undefined>(undefined);

const DEFAULT_WIDTH = 896;
const DEFAULT_HEIGHT = 720;
const CASCADE_OFFSET = 32;
const CASCADE_SLOTS = 6;
const BASE_Z_INDEX = 10000;

export const WindowManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [windows, setWindows] = useState<ManagedWindow[]>([]);
    const zCounterRef = useRef(BASE_Z_INDEX);

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
            };
            return [...prev, win];
        });
    }, []);

    const closeWindow = useCallback((id: string) => {
        setWindows(prev => prev.filter(w => w.id !== id));
    }, []);

    const updateWindow = useCallback((id: string, patch: ManagedWindowPatch) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
    }, []);

    const minimizeWindow = useCallback((id: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    }, []);

    const restoreWindow = useCallback((id: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: ++zCounterRef.current } : w));
    }, []);

    const focusWindow = useCallback((id: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: ++zCounterRef.current } : w));
    }, []);

    const value: WindowManagerContextValue = {
        windows, openWindow, closeWindow, updateWindow, minimizeWindow, restoreWindow, focusWindow,
    };

    return (
        <WindowManagerContext.Provider value={value}>
            {children}
        </WindowManagerContext.Provider>
    );
};

const NOOP_CONTEXT: WindowManagerContextValue = {
    windows: [],
    openWindow: () => {},
    closeWindow: () => {},
    updateWindow: () => {},
    minimizeWindow: () => {},
    restoreWindow: () => {},
    focusWindow: () => {},
};

export const useWindowManager = (): WindowManagerContextValue => {
    const context = useContext(WindowManagerContext);
    // Trees without WindowManagerProvider (e.g. the miniapp) get a safe no-op.
    return context ?? NOOP_CONTEXT;
};
