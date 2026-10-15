/**
 * Document tax type: 'VAT', 'NON-VAT' or 'Commercial Invoice'.
 *
 * "Commercial Invoice" is the third type (Yanet Computer Shop format, YC{year}- numbers).
 * It is the SAME entity as LPT (same books, same numbering engine) but it is its own document
 * type: neither a VAT nor a NON-VAT invoice, so it is never tagged or reported as either.
 * No VAT is charged on it (that is a property of the document, not a NON-VAT label).
 *
 * Why a helper: many places turned the type into `x === 'VAT' ? 'VAT' : 'NON-VAT'` when a
 * quotation became a sale order, or a sale order became an invoice. That collapses a
 * Commercial document into NON-VAT. Use carryTaxType() wherever a type is copied forward.
 */
export const COMMERCIAL = 'Commercial Invoice' as const;
export type DocTaxType = 'VAT' | 'NON-VAT' | typeof COMMERCIAL;

/** True for VAT documents ('VAT', or the legacy 'Yes'). */
export const isVatDoc = (t?: string | null): boolean => t === 'VAT' || t === 'Yes';

/** True for the Commercial Invoice type. */
export const isCommercialDoc = (t?: string | null): boolean => t === COMMERCIAL;

/** Copy a type forward (quotation -> sale order -> invoice) without losing Commercial. */
export const carryTaxType = (t?: string | null): DocTaxType =>
    isCommercialDoc(t) ? COMMERCIAL : isVatDoc(t) ? 'VAT' : 'NON-VAT';

/** The stock/tax bucket a document draws from: only VAT documents use VAT stock. */
export const stockTaxTypeOf = (t?: string | null): 'VAT' | 'NON-VAT' => (isVatDoc(t) ? 'VAT' : 'NON-VAT');

/** Tax Type tag stored on invoice / receipt rows. Commercial keeps its own tag: it is NOT counted as VAT or NON-VAT. */
export const rowTaxTag = (t?: string | null): DocTaxType => carryTaxType(t);
