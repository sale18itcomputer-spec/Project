import { supabase } from '../lib/supabase';

/** One audit-trail entry. Trigger rows (source='trigger') capture raw row
 *  INSERT/UPDATE/DELETE with a JWT-derived actor; app rows (source='app') are
 *  semantic business events written by logAudit() with the reliable currentUser. */
export interface AuditLog {
    id: number;
    occurred_at: string;
    table_name: string;
    record_pk: string | null;
    operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACTION';
    actor_id: string | null;
    actor_name: string | null;
    actor_role: string | null;
    source: 'trigger' | 'app';
    action_label: string | null;
    changed_fields: Record<string, { old: any; new: any }> | null;
    old_row: Record<string, any> | null;
    new_row: Record<string, any> | null;
}

export interface AuditActor {
    id?: string | null;
    name?: string | null;
    role?: string | null;
}

/**
 * Record a semantic business event with the reliable client-side actor.
 *
 * Use for high-value actions where the "who" must be certain and a human label
 * helps (void, finalize, reverse JE, price change, permission change, period
 * lock/unlock). Row-level trigger coverage exists independently; this ADDS the
 * intent + a guaranteed actor on top. Fire-and-forget: never blocks or throws
 * into the calling flow.
 */
export async function logAudit(entry: {
    actionLabel: string;
    actor: AuditActor;
    tableName?: string;
    recordPk?: string | null;
    operation?: 'INSERT' | 'UPDATE' | 'DELETE' | 'ACTION';
    changedFields?: Record<string, { old: any; new: any }> | null;
}): Promise<void> {
    try {
        await supabase.from('audit_logs').insert({
            table_name: entry.tableName ?? 'app',
            record_pk: entry.recordPk ?? null,
            operation: entry.operation ?? 'ACTION',
            actor_id: entry.actor.id ?? null,
            actor_name: entry.actor.name ?? null,
            actor_role: entry.actor.role ?? null,
            source: 'app',
            action_label: entry.actionLabel,
            changed_fields: entry.changedFields ?? null,
        });
    } catch (e) {
        // Auditing must never break the action it records.
        console.warn('[logAudit] failed:', (e as any)?.message ?? e);
    }
}

export interface AuditFilter {
    dateFrom?: string;   // ISO date (inclusive)
    dateTo?: string;     // ISO date (inclusive)
    table?: string;      // exact table_name
    actor?: string;      // substring match on actor_name
    operation?: AuditLog['operation'];
    source?: AuditLog['source'];
    search?: string;     // substring on record_pk or action_label
    limit?: number;      // page size (default 100)
    offset?: number;     // page offset
}

export interface AuditPage {
    rows: AuditLog[];
    count: number;       // total matching rows (for pagination)
}

/** Fetch a filtered, paginated page of audit rows, newest first. */
export async function fetchAuditLogs(filter: AuditFilter = {}): Promise<AuditPage> {
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    let q = supabase
        .from('audit_logs')
        .select('*', { count: 'estimated' })
        .order('occurred_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (filter.dateFrom) q = q.gte('occurred_at', `${filter.dateFrom}T00:00:00`);
    if (filter.dateTo)   q = q.lte('occurred_at', `${filter.dateTo}T23:59:59`);
    if (filter.table)    q = q.eq('table_name', filter.table);
    if (filter.operation) q = q.eq('operation', filter.operation);
    if (filter.source)   q = q.eq('source', filter.source);
    if (filter.actor)    q = q.ilike('actor_name', `%${filter.actor}%`);
    if (filter.search)   q = q.or(`record_pk.ilike.%${filter.search}%,action_label.ilike.%${filter.search}%`);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as AuditLog[], count: count ?? (data?.length ?? 0) };
}

/** Distinct table_names present in the log — populates the viewer's filter dropdown. */
export async function fetchAuditTables(): Promise<string[]> {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('table_name')
        .order('table_name', { ascending: true })
        .limit(2000);
    if (error) return [];
    return [...new Set((data ?? []).map((r: any) => r.table_name))].sort();
}
