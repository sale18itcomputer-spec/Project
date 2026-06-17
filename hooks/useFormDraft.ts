import { useCallback } from 'react';

const PREFIX = 'form-draft:';

/** Read a saved draft synchronously — safe to call in useState/useMemo initialisers. */
export function readFormDraft<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

/** Returns helpers to persist and clear a form draft in sessionStorage. */
export function useFormDraft(key: string) {
    const save = useCallback((data: unknown) => {
        try {
            sessionStorage.setItem(PREFIX + key, JSON.stringify(data));
        } catch {}
    }, [key]);

    const clear = useCallback(() => {
        try {
            sessionStorage.removeItem(PREFIX + key);
        } catch {}
    }, [key]);

    return { save, clear };
}
