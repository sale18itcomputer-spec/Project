
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/promise';
import { ProductInquiry, InquiryItem, PdiRecord, PdiItem } from '../types';

const DETAIL_READ_TIMEOUT_MS = 30000;
const WRITE_TIMEOUT_MS = 30000;

// ── B2B/B2C mode (set by DataContext on initial mount + mode toggle) ──────────
// Module-level state — every CRUD call below transparently routes to the right
// table set based on the current mode. The alternative (passing isB2B to every
// call site) would touch dozens of files and silently regress whenever a new
// caller is added. The mode is set ONCE up-front and updated synchronously on
// every toggle, so there's no race window where the wrong table is queried.
let currentMode: 'B2C' | 'B2B' = 'B2C';

export function setApiMode(mode: 'B2C' | 'B2B'): void {
    currentMode = mode;
}

export function getApiMode(): 'B2C' | 'B2B' {
    return currentMode;
}

// ── Table routing ─────────────────────────────────────────────────────────────
const TABLE_MAP: Record<string, string> = {
    'Pipelines':       'pipelines',
    'Company List':    'companies',
    'Contact_List':    'contacts',
    'Users':           'users',
    'Meeting_Logs':    'meeting_logs',
    'Contact_Logs':    'contact_logs',
    'Site_Survey_Logs':'site_survey_logs',
    'Quotations':      'quotations',
    'Sale Orders':     'sale_orders',
    'Raw':             'pricelist',
    'Invoices':        'invoices',
    'Vendors':         'vendors',
    'Vendor Pricelist':'vendor_pricelist',
    'Purchase Orders': 'purchase_orders',
    'Delivery Orders': 'delivery_orders',
    'Receipts':        'receipts',
    'Inventory':           'inventory',
    'Product Inquiries':   'product_inquiries',
    'Serial Numbers':      'serial_numbers',
    'Service Tickets':     'service_tickets',
    'PDI Records':         'pdi_records',
    'Spare Parts':         'spare_parts',
    'b2b_pipelines':       'b2b_pipelines',
    'b2b_companies':   'b2b_companies',
    'b2b_quotations':  'b2b_quotations',
    'User_Passcodes':  'user_passcodes',
};

// B2B mirror tables. Any base table listed here gets transparently swapped
// when currentMode === 'B2B'. Tables not in this map (vendors, vendor_pricelist,
// purchase_orders, inventory, users, app_settings, ...) stay shared across both modes.
const B2B_TABLE_MAP: Record<string, string> = {
    'pipelines':         'b2b_pipelines',
    'companies':         'b2b_companies',
    'contacts':          'b2b_contacts',
    'meeting_logs':      'b2b_meeting_logs',
    'contact_logs':      'b2b_contact_logs',
    'site_survey_logs':  'b2b_site_survey_logs',
    'quotations':        'b2b_quotations',
    'sale_orders':       'b2b_sale_orders',
    'pricelist':         'b2b_pricelist',
    'invoices':          'b2b_invoices',
    'delivery_orders':   'b2b_delivery_orders',
    'receipts':          'b2b_receipts',
    // inventory is shared: it is procurement-owned (flows from purchase_orders)
    // and has no B2B-specific isolation requirement. b2b_inventory table does
    // not exist in Supabase.
};

/**
 * Resolves a sheet name to its actual Supabase table.
 *
 * When `isB2B` is passed explicitly (the safe path used by DataContext), the
 * mode is taken from the argument — there are zero timing assumptions about
 * `setApiMode` ordering, HMR module resets, or React concurrent renders.
 * When omitted, falls back to the module-level singleton (kept for legacy
 * call sites in modals/forms that haven't been updated yet).
 */
function resolveTable(sheetName: string, isB2B?: boolean): string | undefined {
    const baseTable = TABLE_MAP[sheetName];
    if (!baseTable) return undefined;
    const useB2B = isB2B ?? (currentMode === 'B2B');
    if (useB2B && B2B_TABLE_MAP[baseTable]) {
        return B2B_TABLE_MAP[baseTable];
    }
    return baseTable;
}

/** B2C-table-name → B2B-table-name. Used by realtime subscribers. */
export function resolveTableByBase(baseTable: string, isB2B?: boolean): string {
    const useB2B = isB2B ?? (currentMode === 'B2B');
    if (useB2B && B2B_TABLE_MAP[baseTable]) {
        return B2B_TABLE_MAP[baseTable];
    }
    return baseTable;
}

// Primary keys — must exactly match the column names in Supabase (no trailing dots)
const PRIMARY_KEYS: Record<string, string> = {
    'Pipelines':       'Pipeline No',
    'Company List':    'Company ID',
    'Contact_List':    'Customer ID',
    'Users':           'UserID',
    'Meeting_Logs':    'Meeting ID',
    'Contact_Logs':    'Log ID',
    'Site_Survey_Logs':'Site ID',
    'Quotations':      'Quote No',
    'Sale Orders':     'SO No',
    'Raw':             'Code',
    'Invoices':        'Inv No',
    'Vendors':         'id',
    'Vendor Pricelist':'id',
    'Purchase Orders': 'id',
    'Delivery Orders': 'DO No',
    'Receipts':        'RV No',
    'Inventory':           'id',
    'Product Inquiries':   'id',
    'Serial Numbers':      'id',
    'Service Tickets':     'id',
    'PDI Records':         'id',
    'Spare Parts':         'id',
    'b2b_pipelines':       'Pipeline No',
    'b2b_companies':   'Company ID',
    'b2b_quotations':  'Quote No',
    'User_Passcodes':  'UserID',
};

// Tables that have an updated_at column (trigger keeps them fresh,
// but we stamp on write too so realtime subscribers see the change immediately).
// B2B mirror tables have the same updated_at column so they're listed here too.
const HAS_UPDATED_AT = new Set([
    'quotations', 'sale_orders', 'invoices', 'delivery_orders',
    'receipts', 'vendors', 'vendor_pricelist', 'purchase_orders', 'app_settings',
    'inventory', 'product_inquiries',
    'serial_numbers', 'service_tickets', 'pdi_records', 'spare_parts',
    'b2b_sale_orders', 'b2b_invoices', 'b2b_delivery_orders', 'b2b_receipts',
]);

/** Strip fields that exist in the DB only as computed/read-only or legacy names */
function cleanPayload(sheetName: string, payload: any): any {
    const cleaned = { ...payload };
    // Pipelines have two attachment columns only on the old Google Sheets version
    if (sheetName === 'Pipelines') {
        delete cleaned['Attach Invoice'];
        delete cleaned['Attach DO'];
    }
    return cleaned;
}

function stampedPayload(table: string, payload: any): any {
    if (HAS_UPDATED_AT.has(table)) {
        return { ...payload, updated_at: new Date().toISOString() };
    }
    return payload;
}

// ── Generic CRUD ──────────────────────────────────────────────────────────────

export const createRecord = async (sheetName: string, payload: any, isB2B?: boolean) => {
    const table = resolveTable(sheetName, isB2B);
    if (!table) throw new Error(`No table mapping for "${sheetName}"`);

    const body = stampedPayload(table, cleanPayload(sheetName, payload));

    const { data, error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).insert(body).select().single()
        ),
        WRITE_TIMEOUT_MS,
        `Creating ${sheetName} timed out — please check your connection and try again`,
    );

    if (error) {
        console.error('[createRecord] Supabase error:', error);
        throw new Error(error.message);
    }
    return data;
};

// Supabase's PostgREST enforces a default cap of 1000 rows per response.
// We paginate manually so tables larger than 1000 rows return ALL records —
// without this, newly added rows can be invisible because the existing top-1000
// window doesn't contain them.
const PAGE_SIZE = 1000;

export const readRecords = async <T extends object>(sheetName: string, isB2B?: boolean): Promise<T[]> => {
    const table = resolveTable(sheetName, isB2B);
    if (!table) throw new Error(`No table mapping for "${sheetName}"`);

    const orderColumn = PRIMARY_KEYS[sheetName] ?? 'id';

    // First page also fetches the total row count so we can fire the remaining
    // pages in parallel instead of waiting for each one sequentially. For small
    // tables (< PAGE_SIZE rows) this is a single round-trip.
    const { data: firstData, count, error: firstErr } = await supabase
        .from(table)
        .select('*', { count: 'estimated' })
        .order(orderColumn, { ascending: false })
        .range(0, PAGE_SIZE - 1);

    if (firstErr) {
        console.error('[readRecords] Supabase error:', firstErr);
        throw new Error(firstErr.message);
    }

    const all: T[] = (firstData ?? []) as T[];

    // If the server returned fewer rows than we asked for, we already have everything.
    if (all.length < PAGE_SIZE) return all;

    // Total rows: prefer the count header (estimated is cheaper than exact and
    // accurate enough for pagination loops). Fall back to incremental fetching
    // when count is unavailable.
    const total = typeof count === 'number' ? count : Infinity;

    // Build the list of remaining page requests and fire them in parallel.
    const pageRequests: Promise<{ data: any[] | null; error: any }>[] = [];
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) {
        pageRequests.push(
            Promise.resolve(
                supabase
                    .from(table)
                    .select('*')
                    .order(orderColumn, { ascending: false })
                    .range(from, from + PAGE_SIZE - 1)
            ),
        );
        // Safety guard — never loop more than 100 pages (100k rows) even if
        // count is misreported. Way past the sane size for this workload.
        if (pageRequests.length > 99) break;
    }

    const responses = await Promise.all(pageRequests);
    for (const r of responses) {
        if (r.error) {
            console.error('[readRecords] Supabase error on follow-up page:', r.error);
            throw new Error(r.error.message);
        }
        const rows = (r.data ?? []) as T[];
        if (rows.length === 0) break;
        all.push(...rows);
    }

    return all;
};

export const batchReadRecords = async <T extends object>(sheetNames: string[], isB2B?: boolean): Promise<Record<string, any[]>> => {
    const results: Record<string, any[]> = {};
    await Promise.all(sheetNames.map(async (name) => {
        try {
            results[name] = await readRecords(name, isB2B);
        } catch (e) {
            console.error(`[batchReadRecords] Failed to load "${name}":`, e);
            results[name] = [];
        }
    }));
    return results;
};

export const updateRecord = async (sheetName: string, primaryKeyValue: string, payload: any, isB2B?: boolean) => {
    const table = resolveTable(sheetName, isB2B);
    const pk = PRIMARY_KEYS[sheetName];
    if (!table || !pk) throw new Error(`No config for "${sheetName}"`);

    const body = stampedPayload(table, cleanPayload(sheetName, payload));

    const { data, error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).update(body).eq(pk, primaryKeyValue).select().single()
        ),
        WRITE_TIMEOUT_MS,
        `Updating ${sheetName} timed out — please check your connection and try again`,
    );

    if (error) {
        console.error('[updateRecord] Supabase error:', error);
        throw new Error(error.message);
    }
    return data;
};

export const deleteRecord = async (sheetName: string, primaryKeyValue: string, isB2B?: boolean) => {
    const table = resolveTable(sheetName, isB2B);
    const pk = PRIMARY_KEYS[sheetName];
    if (!table || !pk) throw new Error(`No config for "${sheetName}"`);

    const { error } = await supabase
        .from(table)
        .delete()
        .eq(pk, primaryKeyValue);

    if (error) {
        console.error('[deleteRecord] Supabase error:', error);
        throw new Error(error.message);
    }
    return { deletedId: primaryKeyValue };
};

// ── File upload ───────────────────────────────────────────────────────────────

export const uploadFile = async (file: File): Promise<{ url: string }> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const filePath = `${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

    if (error) {
        console.error('[uploadFile] Supabase error:', error);
        throw new Error(error.message);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

    return { url: publicUrl };
};

// ── Document-specific helpers ─────────────────────────────────────────────────

/** Read a quotation's header + items in one call */
export const readQuotationSheetData = async (quoteId: string): Promise<{
    header: Record<string, any>;
    items: any[];
}> => {
    const table = resolveTableByBase('quotations');
    const { data, error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).select('*').eq('Quote No', quoteId).single()
        ),
        DETAIL_READ_TIMEOUT_MS,
        `Loading quotation ${quoteId} timed out`,
    );

    if (error) throw new Error(error.message);

    let items: any[] = [];
    try {
        items = typeof data['ItemsJSON'] === 'string'
            ? JSON.parse(data['ItemsJSON'])
            : (data['ItemsJSON'] ?? []);
    } catch {
        items = [];
    }

    return { header: data, items };
};

/** Upsert a quotation row (create or update by "Quote No") */
export const createQuotationSheet = async (_sheetName: string, data: any): Promise<{ message: string }> => {
    const table = resolveTableByBase('quotations');
    const payload = stampedPayload(table, { ...data, updated_at: new Date().toISOString() });

    const { error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).upsert(payload, { onConflict: 'Quote No' })
        ),
        WRITE_TIMEOUT_MS,
        `Saving quotation timed out — please check your connection and try again`,
    );

    if (error) {
        console.error('[createQuotationSheet] Supabase error:', error);
        throw new Error(error.message);
    }
    return { message: 'Quotation saved successfully' };
};

/** Upsert a sale order row (create or update by "SO No") */
export const createSaleOrderSheet = async (_sheetName: string, data: any): Promise<{ message: string }> => {
    const table = resolveTableByBase('sale_orders');
    const payload = stampedPayload(table, data);

    const { error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).upsert(payload, { onConflict: 'SO No' })
        ),
        WRITE_TIMEOUT_MS,
        `Saving sale order timed out — please check your connection and try again`,
    );

    if (error) {
        console.error('[createSaleOrderSheet] Supabase error:', error);
        throw new Error(`Failed to save Sale Order: ${error.message}`);
    }
    return { message: 'Sale Order saved successfully' };
};

/** Upsert a delivery order (create or update by "DO No") */
export const createDeliveryOrderSheet = async (data: any): Promise<{ message: string }> => {
    const table = resolveTableByBase('delivery_orders');
    const payload = stampedPayload(table, data);

    const { error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).upsert(payload, { onConflict: 'DO No' })
        ),
        WRITE_TIMEOUT_MS,
        `Saving delivery order timed out — please check your connection and try again`,
    );

    if (error) throw new Error(`Failed to save Delivery Order: ${error.message}`);
    return { message: 'Delivery Order saved successfully' };
};

/** Upsert a receipt (create or update by "RV No") */
export const createReceiptSheet = async (data: any): Promise<{ message: string }> => {
    const table = resolveTableByBase('receipts');
    const payload = stampedPayload(table, data);

    const { error } = await withTimeout(
        Promise.resolve(
            supabase.from(table).upsert(payload, { onConflict: 'RV No' })
        ),
        WRITE_TIMEOUT_MS,
        `Saving receipt timed out — please check your connection and try again`,
    );

    if (error) throw new Error(`Failed to save Receipt: ${error.message}`);
    return { message: 'Receipt saved successfully' };
};

// ── App settings ──────────────────────────────────────────────────────────────

export const getSetting = async (key: string): Promise<any> => {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

    if (error) {
        console.error(`[getSetting] Error fetching "${key}":`, error);
        return null;
    }
    return data?.value ?? null;
};

export const saveSetting = async (key: string, value: any): Promise<void> => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) throw new Error(`Failed to save setting "${key}": ${error.message}`);
};

// ── Product Inquiries helpers ──────────────────────────────────────────────────

export const generateInquiryNo = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `INQ-${year}-`;

    const { data } = await supabase
        .from('product_inquiries')
        .select('inquiry_no')
        .ilike('inquiry_no', `${prefix}%`)
        .order('inquiry_no', { ascending: false })
        .limit(1);

    const lastNo = data?.[0]?.inquiry_no;
    const lastSeq = lastNo ? parseInt(lastNo.replace(prefix, ''), 10) : 0;
    const nextSeq = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

export const saveProductInquiry = async (
    inquiry: Omit<ProductInquiry, 'items'>,
    items: InquiryItem[],
): Promise<{ id: string; inquiry_no: string }> => {
    const { items: _items, ...header } = inquiry as any;
    const payload = stampedPayload('product_inquiries', header);

    const { data: saved, error: hErr } = await withTimeout(
        Promise.resolve(
            supabase
                .from('product_inquiries')
                .upsert(payload, { onConflict: 'inquiry_no' })
                .select('id, inquiry_no')
                .single()
        ),
        WRITE_TIMEOUT_MS,
        'Saving inquiry timed out',
    );
    if (hErr) throw new Error(hErr.message);

    const inquiryId = saved.id;

    const { error: delErr } = await supabase
        .from('inquiry_items')
        .delete()
        .eq('inquiry_id', inquiryId);
    if (delErr) throw new Error(delErr.message);

    if (items.length > 0) {
        const itemPayload = items.map((item, i) => {
            const { id: _id, created_at: _ca, updated_at: _ua, inquiry_id: _iid, ...rest } = item as any;
            return { ...rest, inquiry_id: inquiryId, line_number: i + 1 };
        });
        const { error: itemErr } = await supabase
            .from('inquiry_items')
            .insert(itemPayload);
        if (itemErr) throw new Error(itemErr.message);
    }

    return saved;
};

// ── RMA / Service helpers ──────────────────────────────────────────────────────

export const generateTicketNo = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const { data } = await supabase
        .from('service_tickets')
        .select('ticket_no')
        .ilike('ticket_no', `${prefix}%`)
        .order('ticket_no', { ascending: false })
        .limit(1);
    const lastNo = data?.[0]?.ticket_no;
    const lastSeq = lastNo ? parseInt(lastNo.replace(prefix, ''), 10) : 0;
    return `${prefix}${String((isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0')}`;
};

export const generatePdiNo = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `PDI-${year}-`;
    const { data } = await supabase
        .from('pdi_records')
        .select('pdi_no')
        .ilike('pdi_no', `${prefix}%`)
        .order('pdi_no', { ascending: false })
        .limit(1);
    const lastNo = data?.[0]?.pdi_no;
    const lastSeq = lastNo ? parseInt(lastNo.replace(prefix, ''), 10) : 0;
    return `${prefix}${String((isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0')}`;
};

export const generatePartNo = async (): Promise<string> => {
    const prefix = 'PRT-';
    const { data } = await supabase
        .from('spare_parts')
        .select('part_no')
        .ilike('part_no', `${prefix}%`)
        .order('part_no', { ascending: false })
        .limit(1);
    const lastNo = data?.[0]?.part_no;
    const lastSeq = lastNo ? parseInt(lastNo.replace(prefix, ''), 10) : 0;
    return `${prefix}${String((isNaN(lastSeq) ? 0 : lastSeq) + 1).padStart(4, '0')}`;
};

export const savePdiRecord = async (
    record: Omit<PdiRecord, 'items'>,
    items: PdiItem[],
): Promise<{ id: string; pdi_no: string }> => {
    const { items: _items, ...header } = record as any;
    const payload = stampedPayload('pdi_records', header);

    const { data: saved, error: hErr } = await withTimeout(
        Promise.resolve(
            supabase
                .from('pdi_records')
                .upsert(payload, { onConflict: 'pdi_no' })
                .select('id, pdi_no')
                .single()
        ),
        WRITE_TIMEOUT_MS,
        'Saving PDI record timed out',
    );
    if (hErr) throw new Error(hErr.message);

    const pdiId = saved.id;

    const { error: delErr } = await supabase
        .from('pdi_items')
        .delete()
        .eq('pdi_id', pdiId);
    if (delErr) throw new Error(delErr.message);

    if (items.length > 0) {
        const itemPayload = items.map((item, i) => {
            const { id: _id, created_at: _ca, updated_at: _ua, pdi_id: _pid, ...rest } = item as any;
            return { ...rest, pdi_id: pdiId, line_number: i + 1 };
        });
        const { error: itemErr } = await supabase
            .from('pdi_items')
            .insert(itemPayload);
        if (itemErr) throw new Error(itemErr.message);
    }

    return saved;
};
