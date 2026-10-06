/**
 * Reads a warranty length (in months) out of a pricelist description, e.g.
 *   "3Y Warranty(1st Year Local Perfect Warranty)" -> 36
 *   "Win11 / 3 Years (1Perfect warranty)"          -> 36
 *   "Battery 1yr / HW 3yr warranty"                -> 36 (longest wins)
 *   "Tray (No Warranty)"                           -> 0
 *   "Warranty Type: CRU"                           -> null (nothing numeric)
 *
 * Mirrors parse_warranty_months() in supabase/migrations/20261003_pricelist_warranty_months.sql
 * — keep the two in sync.
 */
const WARRANTY_WINDOW = /[\s\S]{0,35}warrant[\s\S]{0,35}/gi;
const DURATION = /(\d+)\s*(years?|yrs?|y|months?|mths?|mos?)(?![a-z])/gi;

export function parseWarrantyMonths(text?: string | null): number | null {
    if (!text) return null;
    const s = String(text).toLowerCase();
    let best: number | null = null;
    for (const w of s.matchAll(WARRANTY_WINDOW)) {
        for (const d of w[0].matchAll(DURATION)) {
            const n = parseInt(d[1], 10);
            const months = /^y/.test(d[2]) ? n * 12 : n;
            if (months >= 1 && months <= 120 && (best === null || months > best)) best = months;
        }
    }
    if (best !== null) return best;
    return /\bno\s+warranty\b/.test(s) ? 0 : null;
}
