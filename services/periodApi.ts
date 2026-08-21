import { supabase } from '../lib/supabase';
import { logAudit, AuditActor } from './auditApi';

export interface PeriodLock {
    id: number;
    period: string;        // 'YYYY-MM-01'
    status: 'open' | 'locked';
    locked_by: string | null;
    locked_at: string | null;
    unlocked_by: string | null;
    unlocked_at: string | null;
    note: string | null;
    created_at?: string;
    updated_at?: string;
}

/** First-of-month key ('YYYY-MM-01') for any parseable date string. */
export function monthKey(dateStr: string | undefined | null): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        // Fallback for 'M/D/YYYY'
        const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) return null;
        return `${m[3]}-${String(m[1]).padStart(2, '0')}-01`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** True if the given document date falls in a currently-locked month. */
export function isDateInLockedPeriod(dateStr: string | undefined | null, locks: PeriodLock[] | null | undefined): boolean {
    const key = monthKey(dateStr);
    if (!key || !locks) return false;
    return locks.some(l => l.status === 'locked' && String(l.period).slice(0, 10) === key);
}

export async function fetchPeriodLocks(): Promise<PeriodLock[]> {
    const { data, error } = await supabase
        .from('period_locks')
        .select('*')
        .order('period', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PeriodLock[];
}

/** Lock a month. `period` is any date in the month; it's normalized to the 1st. */
export async function lockPeriod(period: string, actor: AuditActor, note?: string): Promise<void> {
    const key = monthKey(period);
    if (!key) throw new Error(`Invalid period: ${period}`);
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('period_locks')
        .upsert(
            {
                period: key, status: 'locked',
                locked_by: actor.name ?? null, locked_at: now,
                note: note ?? null, updated_at: now,
            },
            { onConflict: 'period' },
        );
    if (error) throw new Error(error.message);
    logAudit({
        actionLabel: `Locked period ${key.slice(0, 7)}${note ? ` — ${note}` : ''}`,
        actor, tableName: 'period_locks', recordPk: key, operation: 'ACTION',
    });
}

/** Re-open a locked month (records who unlocked it and why). */
export async function unlockPeriod(period: string, actor: AuditActor, note?: string): Promise<void> {
    const key = monthKey(period);
    if (!key) throw new Error(`Invalid period: ${period}`);
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('period_locks')
        .update({
            status: 'open',
            unlocked_by: actor.name ?? null, unlocked_at: now,
            note: note ?? null, updated_at: now,
        })
        .eq('period', key);
    if (error) throw new Error(error.message);
    logAudit({
        actionLabel: `Unlocked period ${key.slice(0, 7)}${note ? ` — ${note}` : ''}`,
        actor, tableName: 'period_locks', recordPk: key, operation: 'ACTION',
    });
}
