import { supabase } from '../lib/supabase';

/**
 * Generate the next quotation number for B2C or B2B mode
 * B2C: Q-0000001, Q-0000002, etc.
 * B2B: Q-0000001, Q-0000002, etc. (separate sequence)
 */
export const generateNextQuotationNumber = async (isB2B: boolean): Promise<string> => {
    try {
        const tableName = isB2B ? 'b2b_quotations' : 'quotations';

        // Get all quotation numbers from the appropriate table
        const { data, error } = await supabase
            .from(tableName)
            .select('"Quote No."')
            .order('"Quote No."', { ascending: false });

        if (error) {
            console.error(`Error fetching quotations from ${tableName}:`, error);
            return 'Q-0000001';
        }

        if (!data || data.length === 0) {
            return 'Q-0000001';
        }

        // Find the maximum number
        const maxNum = data.reduce((max, q) => {
            const match = q['Quote No.'].match(/Q-(\d+)/);
            if (!match) return max;
            const numPart = parseInt(match[1], 10);
            return isNaN(numPart) ? max : Math.max(max, numPart);
        }, 0);

        return `Q-${String(maxNum + 1).padStart(7, '0')}`;
    } catch (error) {
        console.error('Error generating quotation number:', error);
        return 'Q-0000001';
    }
};

/**
 * Generate quotation number from local data (fallback for offline/cached data)
 */
export const generateQuotationNumberFromData = (quotations: any[], isB2B: boolean): string => {
    if (!quotations || quotations.length === 0) return 'Q-0000001';

    const maxNum = quotations.reduce((max, q) => {
        const match = q['Quote No.'].match(/Q-(\d+)/);
        if (!match) return max;
        const numPart = parseInt(match[1], 10);
        return isNaN(numPart) ? max : Math.max(max, numPart);
    }, 0);

    return `Q-${String(maxNum + 1).padStart(7, '0')}`;
};
