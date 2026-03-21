import { supabase } from '../lib/supabase';
import { Company, PipelineProject, Quotation } from '../types';

/**
 * B2B Database Operations
 * These functions handle CRUD operations for B2B-specific tables
 */

// ============= B2B COMPANIES =============

export const createB2BCompany = async (company: Partial<Company>) => {
    const { data, error } = await supabase
        .from('b2b_companies')
        .insert([company])
        .select();

    if (error) throw error;
    return data;
};

export const updateB2BCompany = async (companyId: string, updates: Partial<Company>) => {
    const { data, error } = await supabase
        .from('b2b_companies')
        .update(updates)
        .eq('Company ID', companyId)
        .select();

    if (error) throw error;
    return data;
};

export const deleteB2BCompany = async (companyId: string) => {
    const { error } = await supabase
        .from('b2b_companies')
        .delete()
        .eq('Company ID', companyId);

    if (error) throw error;
};

export const getB2BCompanies = async () => {
    const { data, error } = await supabase
        .from('b2b_companies')
        .select('*')
        .order('Created Date', { ascending: false });

    if (error) throw error;
    return data;
};

// ============= B2B PIPELINES =============

export const createB2BPipeline = async (pipeline: Partial<PipelineProject>) => {
    const { data, error } = await supabase
        .from('b2b_pipelines')
        .insert([pipeline])
        .select();

    if (error) throw error;
    return data;
};

export const updateB2BPipeline = async (pipelineNo: string, updates: Partial<PipelineProject>) => {
    const { data, error } = await supabase
        .from('b2b_pipelines')
        .update(updates)
        .eq('Pipeline No', pipelineNo)
        .select();

    if (error) throw error;
    return data;
};

export const deleteB2BPipeline = async (pipelineNo: string) => {
    const { error } = await supabase
        .from('b2b_pipelines')
        .delete()
        .eq('Pipeline No', pipelineNo);

    if (error) throw error;
};

export const getB2BPipelines = async () => {
    const { data, error } = await supabase
        .from('b2b_pipelines')
        .select('*')
        .order('Created Date', { ascending: false });

    if (error) throw error;
    return data;
};

// ============= B2B QUOTATIONS =============

export const createB2BQuotation = async (quotation: Partial<Quotation>) => {
    const { data, error } = await supabase
        .from('b2b_quotations')
        .insert([quotation])
        .select();

    if (error) throw error;
    return data;
};

export const updateB2BQuotation = async (quoteNo: string, updates: Partial<Quotation>) => {
    const { data, error } = await supabase
        .from('b2b_quotations')
        .update(updates)
        .eq('Quote No', quoteNo)
        .select();

    if (error) throw error;
    return data;
};

export const deleteB2BQuotation = async (quoteNo: string) => {
    const { error } = await supabase
        .from('b2b_quotations')
        .delete()
        .eq('Quote No', quoteNo);

    if (error) throw error;
};

export const getB2BQuotations = async () => {
    const { data, error } = await supabase
        .from('b2b_quotations')
        .select('*')
        .order('Quote Date', { ascending: false });

    if (error) throw error;
    return data;
};

// ============= UTILITY FUNCTIONS =============

/**
 * Get the appropriate table name based on mode
 */
export const getTableName = (baseTable: string, isB2B: boolean): string => {
    if (!isB2B) return baseTable;

    const b2bTables: Record<string, string> = {
        'companies': 'b2b_companies',
        'pipelines': 'b2b_pipelines',
        'quotations': 'b2b_quotations',
        'vendors': 'vendors', // Shared for now
        'vendor_pricelist': 'vendor_pricelist' // Shared for now
    };

    return b2bTables[baseTable] || baseTable;
};

/**
 * Generic function to insert data into B2C or B2B table
 */
export const insertRecord = async (table: string, data: any, isB2B: boolean) => {
    const tableName = getTableName(table, isB2B);
    const { data: result, error } = await supabase
        .from(tableName)
        .insert([data])
        .select();

    if (error) throw error;
    return result;
};

/**
 * Generic function to update data in B2C or B2B table
 */
export const updateRecord = async (
    table: string,
    primaryKey: string,
    primaryValue: string,
    updates: any,
    isB2B: boolean
) => {
    const tableName = getTableName(table, isB2B);
    const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq(primaryKey, primaryValue)
        .select();

    if (error) throw error;
    return data;
};

/**
 * Generic function to delete data from B2C or B2B table
 */
export const deleteRecord = async (
    table: string,
    primaryKey: string,
    primaryValue: string,
    isB2B: boolean
) => {
    const tableName = getTableName(table, isB2B);
    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq(primaryKey, primaryValue);

    if (error) throw error;
};

/**
 * B2B-aware quotation sheet creation
 * Creates or updates a quotation in the appropriate table
 */
export const createQuotationSheet = async (
    quoteNo: string,
    data: any,
    isB2B: boolean
): Promise<{ message: string; url?: string }> => {
    const tableName = getTableName('quotations', isB2B);

    // Use upsert — avoids a separate existence check and the PostgREST
    // "failed to parse tree path" error caused by .select('Quote No.')
    const { error } = await supabase
        .from(tableName)
        .upsert(data, { onConflict: 'Quote No' });

    if (error) {
        console.error('Supabase Upsert (B2B Quotation) Error:', error);
        throw error;
    }

    return { message: 'Quotation saved successfully', url: '#' };
};

/**
 * B2B-aware quotation sheet data reading
 * Reads quotation data from the appropriate table
 */
export const readQuotationSheetData = async (
    quoteNo: string,
    isB2B: boolean
): Promise<{ header: any; items: any[] }> => {
    const tableName = getTableName('quotations', isB2B);

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('Quote No', quoteNo)
        .single();

    if (error) throw error;

    // Parse items from JSON if stored
    const items = data?.['ItemsJSON'] ? JSON.parse(data['ItemsJSON']) : [];

    return {
        header: data,
        items
    };
};
