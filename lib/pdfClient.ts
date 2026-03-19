/**
 * pdfClient.ts
 * Drop-in replacement for the old jsPDF-based generatePDF().
 * Sends the invoice data to /api/pdf/generate (Puppeteer server-side)
 * and either downloads the file or returns a data-URI for preview.
 *
 * The interface is intentionally kept compatible with the old
 * GeneratePDFOptions in pdfGenerator.ts so callers need minimal changes.
 */

export interface PdfClientOptions {
    type: 'Quotation' | 'Sale Order' | 'Invoice' | 'Delivery Order' | 'Purchase Order';
    headerData: Record<string, any>;
    items: Array<{
        no: number | string;
        itemCode: string;
        modelName?: string;
        description?: string;
        qty: number | string;
        unitPrice?: number | string;
        commission?: number | string;
        amount?: number | string;
    }>;
    totals: { subTotal: number; tax?: number; vat?: number; grandTotal: number };
    currency: 'USD' | 'KHR';
    filename?: string;
    /** If true, returns a blob URL instead of auto-downloading */
    previewMode?: boolean;
}

/**
 * Generates a PDF via the Puppeteer API route.
 * - previewMode=false (default): triggers a file download, returns void
 * - previewMode=true: returns a blob URL (string) you can set as iframe/embed src
 */
export async function generatePDF(opts: PdfClientOptions): Promise<string | void> {
    const res = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: opts.type,
            headerData: opts.headerData,
            items: opts.items,
            totals: opts.totals,
            currency: opts.currency,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(`PDF generation failed: ${err.error || res.statusText}`);
    }

    const blob = await res.blob();

    if (opts.previewMode) {
        // Return a temporary object URL for embedding in an <iframe> / <embed>
        return URL.createObjectURL(blob);
    }

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.filename || `document.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
