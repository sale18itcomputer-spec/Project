import { useCallback } from 'react';

// ── Form draft persistence — DISABLED (save only on explicit Save) ───────────
// The sales team asked to revert to the old behaviour: an in-progress document
// (quotation / invoice / sale order / delivery order / receipt) is kept only in
// component memory and is NOT restored after an accidental page reload. Nothing
// is written to storage as you type — data is persisted only when the user
// clicks Save, which calls the creator's own submit handler.
//
// The API below is intentionally kept identical (readFormDraft / useFormDraft →
// { save, clear }) so the creator components compile and behave unchanged; the
// implementation is simply a no-op. To re-enable draft recovery, restore the
// sessionStorage-backed version of this file from git history.

/** Draft recovery is disabled — always returns null so forms start empty. */
export function readFormDraft<T>(_key: string): T | null {
    return null;
}

/** No-op persistence: save/clear do nothing so nothing is written to storage. */
export function useFormDraft(_key: string) {
    const save = useCallback((_data: unknown) => {}, []);
    const clear = useCallback(() => {}, []);
    return { save, clear };
}
