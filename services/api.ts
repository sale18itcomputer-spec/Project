
import { supabase } from '../lib/supabase';

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
    'b2b_pipelines':   'b2b_pipelines',
    'b2b_companies':   'b2b_companies',
    'b2b_quotations':  'b2b_quotations',
    'User_Passcodes':  'user_passcodes',
};

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
    'b2b_pipelines':   'Pipeline No',
    'b2b_companies':   'Company ID',
    'b2b_quotations':  'Quote No',
    'User_Passcodes':  'UserID',
};

// Tables that have an updated_at column (trigger keeps them fresh,
// but we stamp on write too so realtime subscribers see the change immediately)
const HAS_UPDATED_AT = new Set([
    'quotations', 'sale_orders', 'invoices', 'delivery_orders',
    'receipts', 'vendors', 'vendor_pricelist', 'purchase_orders', 'app_settings',
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

export const createRecord = async (sheetName: string, payload: any) => {
    const table = TABLE_MAP[sheetName];
    if (!table) throw new Error(`No table mapping for "${sheetName}"`);

    const body = stampedPayload(table, cleanPayload(sheetName, payload));

    const { data, error } = await supabase
        .from(table)
        .insert(body)
        .select()
        .single();

    if (error) {
        console.error('[createRecord] Supabase error:', error);
        throw new Error(error.message);
    }
    return data;
};

export const readRecords = async <T extends object>(sheetName: string): Promise<T[]> => {
    const table = TABLE_MAP[sheetName];
    if (!table) throw new Error(`No table mapping for "${sheetName}"`);

    const { data, error } = await supabase.from(table).select('*').order(
        PRIMARY_KEYS[sheetName] ?? 'id', { ascending: false }
    );

    if (error) {
        console.error('[readRecords] Supabase error:', error);
        throw new Error(error.message);
    }
    return (data ?? []) as T[];
};

export const batchReadRecords = async <T extends object>(sheetNames: string[]): Promise<Record<string, any[]>> => {
    const results: Record<string, any[]> = {};
    await Promise.all(sheetNames.map(async (name) => {
        try {
            results[name] = await readRecords(name);
        } catch (e) {
            console.error(`[batchReadRecords] Failed to load "${name}":`, e);
            results[name] = [];
        }
    }));
    return results;
};

export const updateRecord = async (sheetName: string, primaryKeyValue: string, payload: any) => {
    const table = TABLE_MAP[sheetName];
    const pk = PRIMARY_KEYS[sheetName];
    if (!table || !pk) throw new Error(`No config for "${sheetName}"`);

    const body = stampedPayload(table, cleanPayload(sheetName, payload));

    const { data, error } = await supabase
        .from(table)
        .update(body)
        .eq(pk, primaryKeyValue)
        .select()
        .single();

    if (error) {
        console.error('[updateRecord] Supabase error:', error);
        throw new Error(error.message);
    }
    return data;
};

export const deleteRecord = async (sheetName: string, primaryKeyValue: string) => {
    const table = TABLE_MAP[sheetName];
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
    const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('Quote No', quoteId)
        .single();

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
    const payload = stampedPayload('quotations', { ...data, updated_at: new Date().toISOString() });

    const { error } = await supabase
        .from('quotations')
        .upsert(payload, { onConflict: 'Quote No' });

    if (error) {
        console.error('[createQuotationSheet] Supabase error:', error);
        throw new Error(error.message);
    }
    return { message: 'Quotation saved successfully' };
};

/** Upsert a sale order row (create or update by "SO No") */
export const createSaleOrderSheet = async (_sheetName: string, data: any): Promise<{ message: string }> => {
    const payload = stampedPayload('sale_orders', data);

    const { error } = await supabase
        .from('sale_orders')
        .upsert(payload, { onConflict: 'SO No' });

    if (error) {
        console.error('[createSaleOrderSheet] Supabase error:', error);
        throw new Error(`Failed to save Sale Order: ${error.message}`);
    }
    return { message: 'Sale Order saved successfully' };
};

/** Upsert a delivery order (create or update by "DO No") */
export const createDeliveryOrderSheet = async (data: any): Promise<{ message: string }> => {
    const payload = stampedPayload('delivery_orders', data);

    const { error } = await supabase
        .from('delivery_orders')
        .upsert(payload, { onConflict: 'DO No' });

    if (error) throw new Error(`Failed to save Delivery Order: ${error.message}`);
    return { message: 'Delivery Order saved successfully' };
};

/** Upsert a receipt (create or update by "RV No") */
export const createReceiptSheet = async (data: any): Promise<{ message: string }> => {
    const payload = stampedPayload('receipts', data);

    const { error } = await supabase
        .from('receipts')
        .upsert(payload, { onConflict: 'RV No' });

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
