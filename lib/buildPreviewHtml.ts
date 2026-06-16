/**
 * buildPreviewHtml.ts  — CLIENT-SAFE
 * Builds preview HTML entirely in the browser for document types that use
 * CDN fonts (no fs/path). Returns null for types that still need the API.
 *
 * Import chain is intentionally free of server-only modules so Next.js can
 * bundle this for client components without errors.
 */
import { buildQuotationVAT }          from './pdf/buildQuotationVAT';
import { buildQuotationNonVAT }       from './pdf/buildQuotationNonVAT';
import { buildCommercialInvoice }     from './pdf/buildCommercialInvoice';
import { buildReceipt }               from './pdf/buildReceipt';
import { buildDeliveryNote }          from './pdf/buildDeliveryNote';
import { buildTaxInvoice }            from './pdf/buildTaxInvoice';
import { buildSaleOrderClient }       from './pdf/buildSaleOrderClient';
import { buildPurchaseOrderClient }   from './pdf/buildPurchaseOrderClient';
import type { PdfClientOptions }      from './pdfClient';

/** Returns HTML string for client-renderable types, null for server-only types. */
export function buildPreviewHtml(opts: PdfClientOptions): string | null {
    const sym = opts.currency === 'KHR' ? '៛' : '$';
    const { headerData: hd, items, totals } = opts;
    const tax = (totals as any).tax ?? (totals as any).vat ?? 0;

    switch (opts.type) {
        case 'Quotation': {
            const isNonVat = (hd['Tax Type'] || '').toUpperCase() === 'NON-VAT';
            if (isNonVat) {
                return buildQuotationNonVAT(
                    hd, items as any, totals as any, opts.currency, sym,
                    opts.signaturePadding, opts.labelPadding, opts.columnWidths,
                );
            }
            return buildQuotationVAT(
                hd, items as any, totals as any, opts.currency, sym, tax,
                opts.signaturePadding, opts.labelPadding, opts.columnWidths,
            );
        }
        case 'Commercial Invoice': {
            const showVatTin = !!(hd['Tin No.'] || hd['Tin No'] || hd['VAT TIN']);
            return buildCommercialInvoice(
                hd, items as any, totals as any, opts.currency, sym, tax,
                showVatTin, opts.signaturePadding, opts.labelPadding, opts.columnWidths,
            );
        }
        case 'Receipt':
            return buildReceipt(
                hd, items as any, totals as any, opts.currency, sym,
                opts.signaturePadding, opts.labelPadding, opts.columnWidths,
            );
        case 'Delivery Order': {
            // NON-VAT delivery notes omit the company header, mirroring the NON-VAT Invoice template.
            const showVat = (hd['Tax Type'] || hd['Taxable'] || '').toUpperCase() !== 'NON-VAT';
            return buildDeliveryNote(
                hd, items as any, showVat,
                opts.signaturePadding, opts.labelPadding, opts.columnWidths,
            );
        }
        case 'Sale Order':
            return buildSaleOrderClient(
                hd, items as any, totals as any, opts.currency, sym, tax, opts.columnWidths,
                opts.signaturePadding, opts.labelPadding,
            );
        case 'Purchase Order':
            return buildPurchaseOrderClient(
                hd, items as any, totals as any, opts.currency, sym, tax, opts.columnWidths,
            );
        case 'Tax Invoice':
            return buildTaxInvoice(
                hd, items as any, totals as any, opts.currency, sym, tax,
                true, opts.signaturePadding, opts.labelPadding, opts.columnWidths, opts.hideKhmer,
            );
        case 'Invoice':
            return buildTaxInvoice(
                hd, items as any, totals as any, opts.currency, sym, tax,
                false, opts.signaturePadding, opts.labelPadding, opts.columnWidths, opts.hideKhmer,
            );
        default:
            return null;
    }
}
