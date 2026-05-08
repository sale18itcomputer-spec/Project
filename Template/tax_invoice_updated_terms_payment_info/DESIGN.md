---
name: Tax Invoice — Updated Terms & Payment Info
colors:
  primary: '#000000'
  on-primary: '#ffffff'
  brand-accent: '#0056b3'
  surface: '#ffffff'
  surface-dim: '#f2f4f6'
  on-surface: '#000000'
  on-surface-variant: '#444444'
  outline: '#000000'
  outline-variant: '#cccccc'
  background: '#f3f4f6'
  on-background: '#000000'
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
    note: Latin address (whitespace-nowrap)
spacing:
  margin-a4: p-8
  stack-sm: 2px (header-info p margin-bottom)
  stack-md: mb-6
  stack-lg: mt-auto (signature pushed to page bottom)
---

## Variant Overview

Tax invoice with VAT (10%), dual-currency totals (USD + KHR), expanded terms & conditions, and ABA Bank payment information. The most complete invoice variant for VAT-registered-style billing (even without displaying TIN). Issued by Limperial Technology Co., Ltd.

## Key Differences vs. `tax_invoice_non_vat_no_vat_tin`

This variant adds:
1. **VAT row** — "អាករលើតម្លៃបន្ថែម / VAT (10%)" in the totals block.
2. **Dual currency totals** — Grand Total in Dollar + Exchange Rate row + Grand Total in Riel (R prefix).
3. **Deposit row** — "ប្រាក់កក់ / Deposit" above Sub Total.
4. **Terms & Conditions block** — colspan 3, rowspan 6, left of totals. Contains warranty void policy and goods return policy.
5. **Payment Information block** — ABA Bank, account name, account number 003 916 564. Rendered inside the same left colspan cell as Terms.

## Layout: Totals + Terms Block

The bottom of the items table uses a split-cell layout:
- Left side (colspan=3, rowspan=6): Terms & Conditions + Payment Information in 10px text.
- Right side: 6 rows of totals (Deposit, Sub Total, VAT, Grand Total $, Exchange Rate, Grand Total R).

This is the only template with the left-cell terms/payment pattern. All other variants use a simple right-aligned totals block.

## Totals Rows (in order)

1. ប្រាក់កក់ / Deposit
2. សរុប / Sub Total
3. អាករលើតម្លៃបន្ថែម / VAT (10%)
4. សរុបរួមជាប្រាក់ដុល្លារ / Grand Total in Dollar
5. អត្រាប្តូរប្រាក់រៀល / Exchange Rate
6. សរុបរួមជាប្រាក់រៀល / Grand Total in Riel

## Signature Section

Two signature blocks (Customer + Seller), `mt-auto` to push to bottom of A4. Both use a 2px black top border rule with bilingual Khmer/English labels.

## Print Behavior

Same as base: `print-color-adjust: exact`, white bg, no shadow, no padding at print.
