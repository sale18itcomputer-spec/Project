'use client';

import { useSyncExternalStore } from 'react';

/**
 * The app's mobile breakpoint. Matches Tailwind's `lg` and the
 * `.secondary-cell` / `.mobile-*` CSS in globals.css.
 *
 * Three dashboards used to check `width < 768` while AppShell, DataTable and
 * the window manager checked `< 1024`. Between 768px and 1023px that produced
 * a mixed UI: desktop page chrome wrapped around a mobile card list. One
 * constant now, imported everywhere.
 */
export const MOBILE_BREAKPOINT = 1024;

const listeners = new Map<number, Set<() => void>>();
const queries = new Map<number, MediaQueryList>();

function getQuery(breakpoint: number): MediaQueryList | null {
    if (typeof window === 'undefined' || !window.matchMedia) return null;
    let mql = queries.get(breakpoint);
    if (!mql) {
        mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        queries.set(breakpoint, mql);
    }
    return mql;
}

function subscribe(breakpoint: number) {
    return (onChange: () => void) => {
        const mql = getQuery(breakpoint);
        if (!mql) return () => { };

        let set = listeners.get(breakpoint);
        if (!set) {
            set = new Set();
            listeners.set(breakpoint, set);
            mql.addEventListener('change', () => {
                listeners.get(breakpoint)?.forEach(fn => fn());
            });
        }
        set.add(onChange);
        return () => { set!.delete(onChange); };
    };
}

/**
 * `true` below `breakpoint`, SSR-safe.
 *
 * Uses `useSyncExternalStore` rather than a `useEffect` + `window.innerWidth`
 * read. The old `useWindowSize` hook started at `{ width: 0 }`, so
 * `width < 1024` evaluated to `true` on the first client render — every
 * desktop session mounted the entire mobile shell (bottom tab bar, mobile
 * content padding, card-list DataTable) and then tore it down one frame
 * later. Because AppShell's two branches are structurally different, that
 * was a full subtree remount, not a re-render.
 *
 * `useSyncExternalStore` resolves the real value in a synchronous re-render
 * before the browser paints, so there is no visible flash and no wasted mount.
 * The server snapshot is `false` (desktop-first), matching what Next renders.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
    return useSyncExternalStore(
        subscribe(breakpoint),
        () => getQuery(breakpoint)?.matches ?? false,
        () => false,
    );
}

export default useIsMobile;
