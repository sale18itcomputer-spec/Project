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

export function setCookie(name: string, value: string, days: number) {
    if (typeof window === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

export function deleteCookie(name: string) {
    if (typeof window === 'undefined') return;
    document.cookie = name + '=; Max-Age=-99999999; path=/;';
}
