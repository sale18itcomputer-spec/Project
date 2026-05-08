---
name: Quotation — Non-VAT, No VAT TIN
colors:
  primary: '#000000'
  on-primary: '#ffffff'
  brand-accent: '#0056b3'
  surface: '#ffffff'
  on-surface: '#000000'
  outline: '#000000'
  background: '#f3f4f6'
typography:
  h1-display:
    fontFamily: Koh Santepheap
    fontSize: 20px
    fontWeight: '700'
    note: Company name (Khmer)
  h2-section:
    fontFamily: Koh Santepheap
    fontSize: 18px
    fontWeight: '700'
    note: Company name (Latin)
  doc-title:
    fontFamily: Koh Santepheap
    fontSize: 20px
    fontWeight: '700'
    note: Document title bilingual
  body-main:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.6'
  table-header:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '700'
  metadata-sm:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '400'
  metadata-xs:
    fontFamily: Koh Santepheap
    fontSize: 8px
    fontWeight: '400'
spacing:
  margin-a4: p-8
  stack-md: mb-6
  stack-lg: mt-auto
---

## Variant Overview

Quotation (price offer) document for non-VAT entities. Does not display VAT TIN or VAT line. No deposit row. Simplified totals: Sub Total + Grand Total in Dollar only. Issued by Limperial Technology Co., Ltd.

## Key Differences vs. Invoice Variants

- **Document type:** Quotation, not invoice. Title block reads e.g. "តម្លៃ / QUOTATION".
- **No VAT row.** No VAT TIN displayed anywhere.
- **Simplified totals:** Only Sub Total + Grand Total in Dollar (2 rows). No Deposit, no Riel total.
- **Signature labels:** "Prepared By" and "Approved By" (not Customer/Seller). Indicates internal pre-sale sign-off flow.
- **Terms block:** Inline paragraph style (not `<ul>`). Same warranty void policy. colspan=3, rowspan=2 (only 2 total rows vs. 6 in the full invoice).

## Totals Rows (in order)

1. សរុប / Sub Total
2. សរុបបូកបញ្ចូលប្រាក់ដុល្លារ / Grand Total in Dollar

Note: Grand Total label is longer than the invoice variant ("Grand Total in Dollar" with Khmer prefix). Both amounts use `font-bold`.

## Terms Block

Left cell colspan=3, rowspan=2. Plain paragraph text (no `<ul>`), 10px. Paragraphs: warranty policy + goods not returnable + we look forward to hearing from you.

## Signature Section

Two blocks: "Prepared By" (left) and "Approved By" (right). No Khmer labels. `font-bold`, 11px. `mt-auto` to push to page bottom.

## Print Behavior

Same as all variants: `print-color-adjust: exact`, white bg, no shadow at print.
