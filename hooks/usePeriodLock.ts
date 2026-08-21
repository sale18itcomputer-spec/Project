import { useEffect, useState } from 'react';
import { fetchPeriodLocks, isDateInLockedPeriod, monthKey, PeriodLock } from '../services/periodApi';

/**
 * Loads the current period locks once and returns a `lockError(date)` helper for
 * financial editors. `lockError` returns a ready-to-toast message when the given
 * document date falls in a locked month, else null — so a save can bail cleanly
 * BEFORE any number is minted or journal entry is posted. The DB triggers enforce
 * the same rule regardless; this is the friendly early exit.
 */
export function usePeriodLock() {
    const [locks, setLocks] = useState<PeriodLock[]>([]);
    useEffect(() => { fetchPeriodLocks().then(setLocks).catch(() => {}); }, []);

    const lockError = (dateStr: string | undefined | null): string | null => {
        if (!isDateInLockedPeriod(dateStr, locks)) return null;
        return `Period ${monthKey(dateStr)?.slice(0, 7)} is locked — this date is in a closed month. Unlock it in Period Control to save.`;
    };

    return { locks, lockError };
}
