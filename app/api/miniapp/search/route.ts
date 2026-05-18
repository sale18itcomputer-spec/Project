/**
 * POST /api/miniapp/search
 *
 * Server-side cross-module search. Queries Supabase directly so the client
 * doesn't need to have all modules loaded into memory.
 *
 * Body:
 *   initData — Telegram WebApp initData (auth)
 *   query    — search string (min 2 chars)
 *
 * Returns up to 5 results per module, ranked by relevance (exact match first).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function verifyInitData(initData: string): boolean {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return false;
        params.delete('hash');
        const check = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`).join('\n');
        const secret   = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const expected = createHmac('sha256', secret).update(check).digest('hex');
        if (expected !== hash) return false;
        const authDate = parseInt(params.get('auth_date') || '0', 10);
        return Date.now() / 1000 - authDate <= 86400;
    } catch { return false; }
}

export interface SearchResult {
    module: string;         // e.g. 'Quotations'
    label: string;          // e.g. 'Q-0000067'
    sublabel: string;       // e.g. 'Family Health International'
    meta?: string;          // e.g. '$1,200 · In Stock'
    href: string;           // deep-link into miniapp
}

// Each module definition: which Supabase table, which columns to search & display
const MODULES = [
    {
        name: 'Quotations',
        table: 'quotations',
        idCol: 'Quote No',
        searchCols: ['Quote No', 'Company Name', 'Contact Name'],
        labelCol: 'Quote No',
        sublabelCol: 'Company Name',
        metaCols: ['Amount', 'Status'],
        href: (row: any) => `/miniapp/sales/quotations`,
    },
    {
        name: 'Sale Orders',
        table: 'sale_orders',
        idCol: 'SO No',
        searchCols: ['SO No', 'Company Name', 'Contact Name'],
        labelCol: 'SO No',
        sublabelCol: 'Company Name',
        metaCols: ['Total Amount', 'Status'],
        href: (row: any) => `/miniapp/sales/sale-orders`,
    },
    {
        name: 'Invoices',
        table: 'invoices',
        idCol: 'Inv No',
        searchCols: ['Inv No', 'Company Name', 'Contact Name'],
        labelCol: 'Inv No',
        sublabelCol: 'Company Name',
        metaCols: ['Amount', 'Status'],
        href: (row: any) => `/miniapp/sales/invoices`,
    },
    {
        name: 'Delivery Orders',
        table: 'delivery_orders',
        idCol: 'DO No',
        searchCols: ['DO No', 'Company Name', 'Contact Name'],
        labelCol: 'DO No',
        sublabelCol: 'Company Name',
        metaCols: ['Status'],
        href: (row: any) => `/miniapp/sales/delivery-orders`,
    },
    {
        name: 'Receipts',
        table: 'receipts',
        idCol: 'RV No',
        searchCols: ['RV No', 'Company Name', 'Contact Name'],
        labelCol: 'RV No',
        sublabelCol: 'Company Name',
        metaCols: ['Amount', 'Status'],
        href: (row: any) => `/miniapp/sales/receipts`,
    },
    {
        name: 'Purchase Orders',
        table: 'purchase_orders',
        idCol: 'po_number',
        searchCols: ['po_number', 'vendor_name'],
        labelCol: 'po_number',
        sublabelCol: 'vendor_name',
        metaCols: ['grand_total', 'status'],
        href: (row: any) => `/miniapp/sales/purchase-orders`,
    },
] as const;

export async function POST(req: NextRequest) {
    try {
        const { initData, query } = await req.json();

        if (!verifyInitData(initData ?? ''))
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const q = (query ?? '').trim();
        if (q.length < 2)
            return NextResponse.json({ results: [] });

        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
        const pattern = `%${q}%`;

        // Run all module searches in parallel
        const moduleResults = await Promise.all(
            MODULES.map(async (mod) => {
                try {
                    // Build OR filter across all searchable columns using ilike
                    const orFilter = mod.searchCols
                        .map(col => `"${col}".ilike.${pattern}`)
                        .join(',');

                    const { data, error } = await sb
                        .from(mod.table)
                        .select(
                            [...new Set([...mod.searchCols, ...mod.metaCols])].join(', ')
                        )
                        .or(orFilter)
                        .limit(5);

                    if (error || !data) return [];

                    return data.map((row): SearchResult => {
                        const metaParts = mod.metaCols
                            .map(c => row[c])
                            .filter(Boolean)
                            .join(' · ');
                        return {
                            module:   mod.name,
                            label:    row[mod.labelCol] ?? '',
                            sublabel: row[mod.sublabelCol] ?? '',
                            meta:     metaParts || undefined,
                            href:     mod.href(row),
                        };
                    });
                } catch {
                    return [];
                }
            })
        );

        const results = moduleResults.flat();

        // Sort: exact label matches first, then by module order
        results.sort((a, b) => {
            const aExact = a.label.toLowerCase() === q.toLowerCase() ? 0 : 1;
            const bExact = b.label.toLowerCase() === q.toLowerCase() ? 0 : 1;
            return aExact - bExact;
        });

        return NextResponse.json({ results });
    } catch (err: any) {
        console.error('[miniapp/search]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
