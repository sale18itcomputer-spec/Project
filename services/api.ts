
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
    // B2B Mappings
    'b2b_pipelines': 'b2b_pipelines',
    'b2b_companies': 'b2b_companies',
    'b2b_quotations': 'b2b_quotations',
    'User_Passcodes': 'user_passcodes',
};

// Configuration for primary keys (matching the old config for compatibility)
// Updated to wrap keys with spaces in double quotes for PostgREST compatibility
const SHEET_CONFIG: { [key: string]: { primaryKey: string } } = {
    'Pipelines': { primaryKey: '"Pipeline No."' },
    'Company List': { primaryKey: '"Company ID"' },
    'Contact_List': { primaryKey: '"Customer ID"' },
    'Users': { primaryKey: 'UserID' },
    'Meeting_Logs': { primaryKey: '"Meeting ID"' },
    'Contact_Logs': { primaryKey: '"Log ID"' },
    'Site_Survey_Logs': { primaryKey: '"Site ID"' },
    'Quotations': { primaryKey: '"Quote No."' },
    'Sale Orders': { primaryKey: '"SO No."' },
    'Raw': { primaryKey: '"Code"' },
    'Invoices': { primaryKey: '"Inv No."' },
    // Procurement / Vendor tables
    'Vendors': { primaryKey: 'id' },
    'Vendor Pricelist': { primaryKey: 'id' },
    'Purchase Orders': { primaryKey: 'id' },
    // B2B Config
    'b2b_pipelines': { primaryKey: '"Pipeline No."' },
    'b2b_companies': { primaryKey: '"Company ID"' },
    'b2b_quotations': { primaryKey: '"Quote No."' },
    'User_Passcodes': { primaryKey: 'UserID' },
};

/**
 * Creates a new record in the database.
 * @param sheetName The name of the logical sheet/table.
 * @param payload An object where keys are column headers and values are the cell contents.
 */
export const createRecord = async (sheetName: string, payload: any) => {
    const table = TABLE_MAP[sheetName];
    if (!table) throw new Error(`Table mapping not found for ${sheetName}`);

    // Clean payload for Pipelines to remove deprecated columns
    let cleanedPayload = { ...payload };
    if (sheetName === 'Pipelines') {
        const { 'Attach Invoice': _ai, 'Attach D.O': _ado, ...rest } = cleanedPayload;
        cleanedPayload = rest;
    }

    const { data, error } = await supabase
        .from(table)
        .insert(cleanedPayload)
        .select()
        .single();

    if (error) {
        console.error("Supabase Create Error:", error);
        throw new Error(error.message);
    }
    return data;
};

/**
 * Reads all records from a specified table.
 * @param sheetName The name of the sheet/table to read from.
 * @returns A promise that resolves with an array of records.
 */
export const readRecords = async <T extends {}>(sheetName: string): Promise<T[]> => {
    const table = TABLE_MAP[sheetName];
    if (!table) throw new Error(`Table mapping not found for ${sheetName}`);

    const { data, error } = await supabase
        .from(table)
        .select('*');

    if (error) {
        console.error("Supabase Read Error:", error);
        throw new Error(error.message);
    }
    return data as T[];
};

/**
 * Reads all records from multiple specified tables in a single batch (parallel requests).
 * @param sheetNames An array of sheet/table names to read from.
 * @returns A promise that resolves with an object where keys are sheet names and values are arrays of records.
 */
export const batchReadRecords = async <T extends {}>(sheetNames: string[]): Promise<any> => {
    const results: { [key: string]: any[] } = {};

    await Promise.all(sheetNames.map(async (name) => {
        try {
            results[name] = await readRecords(name);
        } catch (e) {
            console.error(`Failed to load ${name}`, e);
            results[name] = [];
        }
    }));

    return results;
};

/**
 * Updates an existing record.
 * @param sheetName The name of the sheet/table.
 * @param primaryKeyValue The value of the primary key for the row to update.
 * @param payload An object containing the key-value pairs to update.
 */
export const updateRecord = async (sheetName: string, primaryKeyValue: string, payload: any) => {
    const table = TABLE_MAP[sheetName];
    const primaryKey = SHEET_CONFIG[sheetName]?.primaryKey;
    if (!table || !primaryKey) throw new Error(`Configuration missing for ${sheetName}`);

    // Clean payload for Pipelines to remove deprecated columns
    let cleanedPayload = { ...payload };
    if (sheetName === 'Pipelines') {
        const { 'Attach Invoice': _ai, 'Attach D.O': _ado, ...rest } = cleanedPayload;
        cleanedPayload = rest;
    }

    const { data, error } = await supabase
        .from(table)
        .update(cleanedPayload)
        .eq(primaryKey, primaryKeyValue)
        .select()
        .single();

    if (error) {
        console.error("Supabase Update Error:", error);
        throw new Error(error.message);
    }
    return data;
};

/**
 * Deletes a record.
 * @param sheetName The name of the sheet/table.
 * @param primaryKeyValue The value of the primary key for the row to delete.
 */
export const deleteRecord = async (sheetName: string, primaryKeyValue: string) => {
    const table = TABLE_MAP[sheetName];
    const primaryKey = SHEET_CONFIG[sheetName]?.primaryKey;
    if (!table || !primaryKey) throw new Error(`Configuration missing for ${sheetName}`);

    const { error } = await supabase
        .from(table)
        .delete()
        .eq(primaryKey, primaryKeyValue);

    if (error) {
        console.error("Supabase Delete Error:", error);
        throw new Error(error.message);
    }
    return { deletedId: primaryKeyValue };
};

/**
 * Uploads a file to Supabase Storage.
 * @param file The file to upload.
 * @returns A promise that resolves with the URL of the uploaded file.
 */
export const uploadFile = async (file: File): Promise<{ url: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Make sure to create a bucket named 'attachments' in your Supabase project
    const { data, error } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

    if (error) {
        console.error("Supabase Upload Error:", error);
        throw new Error(error.message);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

    return { url: publicUrl };
};

/**
 * Reads detailed data for a specific quotation.
 * @param quoteId The ID of the quotation.
 */
export const readQuotationSheetData = async (quoteId: string): Promise<{
    header: { [key: string]: any };
    items: any[];
}> => {
    const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('"Quote No."', quoteId) // Use quotes for columns with spaces
        .single();

    if (error) throw new Error(error.message);

    // In the old system, ItemsJSON was a string field. In Supabase, if we use JSONB, it returns an object.
    // If we used text, it returns a string.
    let items = [];
    try {
        if (typeof data['ItemsJSON'] === 'string') {
            items = JSON.parse(data['ItemsJSON']);
        } else {
            items = data['ItemsJSON'] || [];
        }
    } catch (e) {
        items = [];
    }

    return {
        header: data,
        items: items
    };
};

/**
 * "Creates a sheet" -> functionality mapped to creating a record.
 * @param newSheetName The ID (e.g. Quote No.)
 * @param data The full data object.
 */
export const createQuotationSheet = async (newSheetName: string, data: any): Promise<{ message: string, url?: string }> => {
    // In Supabase, we already have the record created via 'createRecord' usually, 
    // or this function is called to finalize it. 
    // Since the previous implementation implied creating a NEW sheet tab, but here we just ensure the record exists.
    // If this is a duplicate of createRecord, we might just update or upsert.

    // Check if exists
    const existing = await supabase.from('quotations').select('"Quote No."').eq('"Quote No."', newSheetName).maybeSingle();

    if (existing.data) {
        await updateRecord('Quotations', newSheetName, data);
    } else {
        await createRecord('Quotations', data);
    }

    return { message: 'Quotation saved successfully', url: '#' };
};

/**
 * "Creates a sheet" -> functionality mapped to creating a record.
 * @param newSheetName The ID (e.g. SO No.)
 * @param data The full data object.
 */
export const createSaleOrderSheet = async (newSheetName: string, data: any): Promise<{ message: string, url?: string }> => {
    const { error } = await supabase
        .from('sale_orders')
        .upsert(data, { onConflict: '"SO No."' });

    if (error) {
        throw new Error(`Failed to save Sale Order: ${error.message}`);
    }

    return { message: 'Sale Order saved successfully', url: '#' };
};

/**
 * Retrieves a global application setting.
 */
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

/**
 * Saves or updates a global application setting.
 */
export const saveSetting = async (key: string, value: any): Promise<void> => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) {
        throw new Error(`Failed to save setting ${key}: ${error.message}`);
    }
};
