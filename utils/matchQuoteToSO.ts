import { SaleOrder, Quotation } from '../types';

function extractItemCodes(raw: any): Set<string> {
    const codes = new Set<string>();
    if (!raw) return codes;
    try {
        const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(items)) {
            for (const i of items) {
                const code = (i.modelName || i.Model || i.Description || i.description || i.Code || i.itemCode || '').trim().toLowerCase();
                if (code) codes.add(code);
            }
        }
    } catch { /* ignore */ }
    if (typeof raw === 'string' && !raw.startsWith('[') && !raw.startsWith('{') && raw.trim()) {
        codes.add(raw.trim().toLowerCase());
    }
    return codes;
}

function itemOverlapScore(a: any, b: any): number {
    const codesA = extractItemCodes(a);
    const codesB = extractItemCodes(b);
    if (codesA.size === 0 || codesB.size === 0) return 0;
    let matches = 0;
    for (const c of codesA) if (codesB.has(c)) matches++;
    return matches / Math.max(codesA.size, codesB.size);
}

function normaliseCompany(name: string | undefined): string {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * For each SO that has no Quote No, find the best-matching Quotation by:
 * 1. Same company name (required)
 * 2. Highest item overlap score (>= 0.5 threshold)
 * Returns a Map<SO No, Quotation>
 */
export function buildFuzzyQuoteMap(
    saleOrders: SaleOrder[],
    quotations: Quotation[],
): Map<string, Quotation> {
    const result = new Map<string, Quotation>();

    const unlinkedSOs = saleOrders.filter(so => !so['Quote No'] && so['SO No']);

    for (const so of unlinkedSOs) {
        const soCompany = normaliseCompany(so['Company Name']);
        let bestScore = 0.5; // minimum threshold
        let bestQuote: Quotation | null = null;

        for (const q of quotations) {
            if (normaliseCompany(q['Company Name']) !== soCompany) continue;
            const score = itemOverlapScore(so['ItemsJSON'], q['ItemsJSON']);
            if (score > bestScore) {
                bestScore = score;
                bestQuote = q;
            }
        }

        if (bestQuote) result.set(so['SO No'], bestQuote);
    }

    return result;
}
