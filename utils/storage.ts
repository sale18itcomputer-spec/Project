/**
 * SSR-safe localStorage helpers.
 * Returns null / does nothing when called during server-side rendering.
 */

export function localStorageGet(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(key); } catch { return null; }
}

export function localStorageSet(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function localStorageRemove(key: string): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}
