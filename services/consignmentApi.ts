import { supabase } from '../lib/supabase';
import { Consignment, ConsignmentItem } from '../types';

export const fetchConsignments = async (): Promise<Consignment[]> => {
    const { data: headers, error } = await supabase
        .from('consignments')
        .select('*')
        .order('transfer_date', { ascending: false });
    if (error) throw new Error(error.message);
    if (!headers?.length) return [];

    const ids = headers.map(h => h.id);
    const { data: items, error: itemsErr } = await supabase
        .from('consignment_items')
        .select('*')
        .in('consignment_id', ids)
        .order('item_no', { ascending: true });
    if (itemsErr) throw new Error(itemsErr.message);

    return headers.map(h => ({
        ...h,
        items: (items ?? []).filter(i => i.consignment_id === h.id),
    }));
};

export const createConsignment = async (
    header: Omit<Consignment, 'id' | 'items' | 'created_at' | 'updated_at'>,
    items: Omit<ConsignmentItem, 'id' | 'consignment_id' | 'created_at' | 'updated_at'>[],
): Promise<Consignment> => {
    const { data: c, error } = await supabase
        .from('consignments')
        .insert(header)
        .select()
        .single();
    if (error) throw new Error(error.message);

    const rows = items.map(i => ({ ...i, consignment_id: c.id }));
    const { data: createdItems, error: itemsErr } = await supabase
        .from('consignment_items')
        .insert(rows)
        .select();
    if (itemsErr) throw new Error(itemsErr.message);

    return { ...c, items: createdItems ?? [] };
};

export const updateConsignment = async (
    id: string,
    payload: Partial<Omit<Consignment, 'id' | 'items' | 'created_at' | 'updated_at'>>,
): Promise<Consignment> => {
    const { data, error } = await supabase
        .from('consignments')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const updateConsignmentItem = async (
    id: string,
    payload: Partial<Omit<ConsignmentItem, 'id' | 'consignment_id' | 'created_at' | 'updated_at'>>,
): Promise<ConsignmentItem> => {
    const { data, error } = await supabase
        .from('consignment_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const deleteConsignment = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('consignments')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
};
