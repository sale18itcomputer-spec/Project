/**
 * Customer statement generation — builds the row set for a company's account
 * statement from Invoices + Receipts and sends it through the PDF pipeline.
 */
import { Invoice, Receipt, Company } from '../types';
import { computeInvoiceAR } from './collection';
import { generatePDF } from '../lib/pdfClient';
import { isServiceInvoice } from './serviceInvoice';

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toInputDate = (v: string | undefined): string | undefined => {
    if (!v) return undefined;
    // Invoice dates may be M/D/YYYY; normalise to YYYY-MM-DD for the PDF's fmtDate.
    const parts = v.includes('/') ? v.split('/') : null;
    if (parts && parts.length === 3) {
        const [m, d, y] = parts;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return v.slice(0, 10);
};

export interface GenerateStatementArgs {
    company: Pick<Company, 'Company Name'> & Record<string, any>;
    invoices: Invoice[] | null | undefined;
    receipts: Receipt[] | null | undefined;
    /** true → only invoices with an outstanding balance; false → full history. */
    openOnly?: boolean;
}

/**
 * Build and download a customer account statement PDF.
 * Returns the number of invoices included (0 → nothing to state).
 */
export async function generateCustomerStatement(args: GenerateStatementArgs): Promise<number> {
    const { company, invoices, receipts, openOnly = true } = args;
    const companyName = company['Company Name'];

    const companyInvoices = (invoices ?? []).filter(
        inv => inv['Company Name'] === companyName && inv.Status !== 'Draft' && inv.Status !== 'Cancel',
    );

    const rows = companyInvoices
        .map(inv => {
            const ar = computeInvoiceAR(inv, receipts);
            return {
                invNo: inv['Inv No'],
                invDate: toInputDate(inv['Inv Date']),
                dueDate: ar.dueDate ? ar.dueDate.toISOString().slice(0, 10) : undefined,
                invoiced: ar.invoiced - ar.deposit,
                paid: ar.paid,
                outstanding: ar.outstanding,
                status: ar.collectionStatus,
                daysPastDue: ar.daysPastDue,
                _service: isServiceInvoice(inv),
            };
        })
        .filter(r => (openOnly ? r.outstanding > 0.005 : true))
        // Oldest first — statements read top-down chronologically.
        .sort((a, b) => String(a.invDate ?? '').localeCompare(String(b.invDate ?? '')));

    if (rows.length === 0) return 0;

    // Statement currency: the company's most common invoice currency (USD default).
    const ccyCounts: Record<string, number> = {};
    for (const inv of companyInvoices) {
        const c = inv.Currency || 'USD';
        ccyCounts[c] = (ccyCounts[c] ?? 0) + 1;
    }
    const currency = (Object.entries(ccyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as 'USD' | 'KHR') || 'USD';

    await generatePDF({
        type: 'Statement',
        headerData: {
            companyName,
            companyAddress: company['Address (English)'] || company['Company Address'] || '',
            contactName: company['Contact Name'] || '',
            phone: company['Phone Number'] || company['Tel (1)'] || '',
            email: company['Email'] || '',
            statementDate: todayStr(),
        },
        statementRows: rows.map(({ _service, ...r }) => r),
        items: [],
        totals: { subTotal: 0, grandTotal: 0 },
        currency,
        filename: `Statement_${String(companyName).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`,
    });

    return rows.length;
}
