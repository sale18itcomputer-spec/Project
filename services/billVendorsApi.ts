import { supabase } from '../lib/supabase';
import { BillVendor } from '../types';

const TABLE = 'bill_vendors';

export async function fetchBillVendors(): Promise<BillVendor[]> {
    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('vendor_name');
    if (error) throw new Error(error.message);
    return (data ?? []) as BillVendor[];
}

export async function createBillVendor(v: Omit<BillVendor, 'id' | 'created_at' | 'updated_at'>): Promise<BillVendor> {
    const { data, error } = await supabase
        .from(TABLE)
        .insert(v)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as BillVendor;
}

export async function updateBillVendor(id: string, v: Partial<BillVendor>): Promise<BillVendor> {
    const { data, error } = await supabase
        .from(TABLE)
        .update({ ...v, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as BillVendor;
}

export async function deleteBillVendor(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
}
