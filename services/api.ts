
import { supabase } from '../lib/supabase';

// Map Google Sheet names to Supabase tables
const TABLE_MAP: { [key: string]: string } = {
    'Pipelines': 'pipelines',
    'Company List': 'companies',
    'Contact_List': 'contacts',
    'Users': 'users',
    'Meeting_Logs': 'meeting_logs',
    'Contact_Logs': 'contact_logs',
    'Site_Survey_Logs': 'site_survey_logs',
    'Quotations': 'quotations',
    'Sale Orders': 'sale_orders',
    'Raw': 'pricelist',
    'Invoices': 'invoices',
    // Procurement / Vendor tables
    'Vendors': 'vendors',
    'Vendor Pricelist': 'vendor_pricelist',
    'Purchase Orders': 'purchase_orders',
    // Delivery & Receipt
    'Delivery Orders': 'delivery_orders',
    'Receipts': 'receipts',
    // B2B Mappings
    'b2b_pipelines': 'b2b_pipelines',
    'b2b_companies': 'b2b_companies',
    'b2b_quotations': 'b2b_quotations',
    'User_Passcodes': 'user_passcodes',
};

// Configuration for primary keys.
const SHEET_CONFIG: { [key: string]: { primaryKey: string } } = {
    'Pipelines': { primaryKey: 'Pipeline No' },
    'Company List': { primaryKey: 'Company ID' },
    'Contact_List': { primaryKey: 'Customer ID' },
    'Users': { primaryKey: 'UserID' },
    'Meeting_Logs': { primaryKey: 'Meeting ID' },
    'Contact_Logs': { primaryKey: 'Log ID' },
    'Site_Survey_Logs': { primaryKey: 'Site ID' },
    'Quotations': { primaryKey: 'Quote No' },
    'Sale Orders': { primaryKey: 'SO No' },
    'Raw': { primaryKey: 'Code' },
    'Invoices': { primaryKey: 'Inv No' },
    // Procurement / Vendor tables
    'Vendors': { primaryKey: 'id' },
    'Vendor Pricelist': { primaryKey: 'id' },
    'Purchase Orders': { primaryKey: 'id' },
    // Delivery & Receipt
    'Delivery Orders': { primaryKey: 'DO No' },
    'Receipts': { primaryKey: 'RV No' },
    // B2B Config
    'b2b_pipelines': { primaryKey: 'Pipeline No' },
    'b2b_companies': { primaryKey: 'Company ID' },
    'b2b_quotations': { primaryKey: 'Quote No' },
    'User_Passcodes': { primaryKey: 'UserID' },
};

export const createRecord = async (sheetName: string, payload: any) => {
    const table = TABLE_MAP[sheetName];
    if (!table) throw new Error(`Table mapping not found for ${sheetName}`);

    let cleanedPayload = { ...payload };
    if (sheetName === 'Pipelines') {
        const { 'Attach Invoice': _ai, 'Attach DO': _ado, ...rest } = cleanedPayload;
        cleanedPayload = rest;
    }

    const { data, error } = await supabase
        .from(table)
        .insert(cleanedPayload)
        .select()
        .single();

    if (error) {
        console.error('Supabase Create Error:', error);
        throw new Error(error.message);
    }
    return data;
};

export const readRecords = async <T extends {}>(sheetName: string): Promise<T[]> => {
    const table = TABLE_MAP[sheetName];
    if (!table) throw new Error(`Table mapping not found for ${sheetName}`);

    const { data, error } = await supabase.from(table).select('*');

    if (error) {
        console.error('Supabase Read Error:', error);
        throw new Error(error.message);
    }
    return data as T[];
};

// eslint-disable-next-line unused-imports/no-unused-vars
export const batchReadRecords = async <T extends {}>(sheetNames: string[]): Promise<any> => {
    const results: { [key: string]: any[] } = {};

    await Promise.all(sheetNames.map(async (name) => {
        try {
            results[name] = await readRecords(name);
        } catch (_e) {
            console.error(`Failed to load ${name}`, _e);
            results[name] = [];
        }
    }));

    return results;
};

export const updateRecord = async (sheetName: string, primaryKeyValue: string, payload: any) => {
    const table = TABLE_MAP[sheetName];
    const primaryKey = SHEET_CONFIG[sheetName]?.primaryKey;
    if (!table || !primaryKey) throw new Error(`Configuration missing for ${sheetName}`);

    let cleanedPayload = { ...payload };
    if (sheetName === 'Pipelines') {
        const { 'Attach Invoice': _ai, 'Attach DO': _ado, ...rest } = cleanedPayload;
        cleanedPayload = rest;
    }

    const { data, error } = await supabase
        .from(table)
        .update(cleanedPayload)
        .eq(primaryKey, primaryKeyValue)
        .select()
        .single();

    if (error) {
        console.error('Supabase Update Error:', error);
        throw new Error(error.message);
    }
    return data;
};

export const deleteRecord = async (sheetName: string, primaryKeyValue: string) => {
    const table = TABLE_MAP[sheetName];
    const primaryKey = SHEET_CONFIG[sheetName]?.primaryKey;
    if (!table || !primaryKey) throw new Error(`Configuration missing for ${sheetName}`);

    const { error } = await supabase
        .from(table)
        .delete()
        .eq(primaryKey, primaryKeyValue);

    if (error) {
        console.error('Supabase Delete Error:', error);
        throw new Error(error.message);
    }
    return { deletedId: primaryKeyValue };
};

export const uploadFile = async (file: File): Promise<{ url: string }> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data: _data, error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

    if (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error(error.message);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

    return { url: publicUrl };
};

export const readQuotationSheetData = async (quoteId: string): Promise<{
    header: { [key: string]: any };
    items: any[];
}> => {
    const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('Quote No', quoteId)
        .single();

    if (error) throw new Error(error.message);

    let items = [];
    try {
        if (typeof data['ItemsJSON'] === 'string') {
            items = JSON.parse(data['ItemsJSON']);
        } else {
            items = data['ItemsJSON'] || [];
        }
    } catch (_e) {
        items = [];
    }

    return { header: data, items };
};

export const createQuotationSheet = async (newSheetName: string, data: any): Promise<{ message: string, url?: string }> => {
    const payload = {
        ...data,
        updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
        .from('quotations')
        .upsert(payload, { onConflict: 'Quote No' });

    if (error) {
        console.error('Supabase Upsert (Quotation) Error:', error);
        throw new Error(error.message);
    }

    return { message: 'Quotation saved successfully', url: '#' };
};

export const createSaleOrderSheet = async (newSheetName: string, data: any): Promise<{ message: string, url?: string }> => {
    const { error } = await supabase
        .from('sale_orders')
        .upsert(data, { onConflict: 'SO No' });

    if (error) {
        throw new Error(`Failed to save Sale Order: ${error.message}`);
    }

    return { message: 'Sale Order saved successfully', url: '#' };
};

export const createDeliveryOrderSheet = async (data: any): Promise<{ message: string }> => {
    const payload = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabase
        .from('delivery_orders')
        .upsert(payload, { onConflict: 'DO No' });

    if (error) throw new Error(`Failed to save Delivery Order: ${error.message}`);
    return { message: 'Delivery Order saved successfully' };
};

export const createReceiptSheet = async (data: any): Promise<{ message: string }> => {
    const payload = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabase
        .from('receipts')
        .upsert(payload, { onConflict: 'RV No' });

    if (error) throw new Error(`Failed to save Receipt: ${error.message}`);
    return { message: 'Receipt saved successfully' };
};

export const getSetting = async (key: string): Promise<any> => {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

    if (error) {
        console.error(`Error fetching setting ${key}:`, error);
        return null;
    }
    return data?.value || null;
};

export const saveSetting = async (key: string, value: any): Promise<void> => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) {
        throw new Error(`Failed to save setting ${key}: ${error.message}`);
    }
};
