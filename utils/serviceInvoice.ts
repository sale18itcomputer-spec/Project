/**
 * serviceInvoice.ts — shared discriminators for the Service Invoice document type.
 *
 * Service invoices live in the same `invoices` table as sales invoices but are
 * a separate series:
 *  • Own number prefix  — SI{year}-##### (see generateServiceInvNo in services/api)
 *  • Own PDF title      — "SERVICE INVOICE"
 *  • Marked via Remark  — 'Service Ticket: TK-…' (from a ticket) or 'Service Invoice' (standalone)
 *
 * Older service invoices created before the SI series exist with INV/TI numbers,
 * so the predicate checks both the number prefix and the Remark markers.
 */

export const SERVICE_INV_NO_REGEX = /^SI\d{4}-/;
export const SERVICE_REMARK_PREFIX = 'Service Ticket: ';
export const SERVICE_REMARK_PLAIN = 'Service Invoice';

export const isServiceInvoice = (inv: Record<string, any>): boolean => {
    const invNo: string = inv?.['Inv No'] ?? '';
    const remark: string = inv?.['Remark'] ?? '';
    return (
        SERVICE_INV_NO_REGEX.test(invNo) ||
        remark.startsWith(SERVICE_REMARK_PREFIX) ||
        remark === SERVICE_REMARK_PLAIN
    );
};
