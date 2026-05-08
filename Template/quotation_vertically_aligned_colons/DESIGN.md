---
name: Quotation — Vertically Aligned Colons
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
    fontSize: 20px (text-xl)
    fontWeight: '700'
    note: Company name (Khmer)
  h2-section:
    fontFamily: Koh Santepheap
    fontSize: 18px (text-lg)
    fontWeight: '700'
    note: Company name (Latin)
  doc-title:
    fontFamily: Koh Santepheap
    fontSize: 20px (text-xl)
    fontWeight: '700'
    note: Document title — "សម្រង់តម្លៃ / QUOTATION"
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
  stack-md: mb-6
  stack-lg: mt-auto
---

## Variant Overview

Quotation variant that adds two structural refinements: (1) vertically aligned colons in the customer info section via a dedicated colon `<td>`, and (2) VAT TIN displayed in both the header and the customer info table. Includes VAT 10% in totals. Prepared By / Approved By signature block.

## Key Differentiator: Vertically Aligned Colons

The customer/document info section uses a **3-column borderless table** to achieve colon alignment:

```
| Label (font-bold, w-1/3) | : (fixed width td) | Value |
```

Each row is `<td>label</td><td>:</td><td>value</td>`. The colon column has `w-[10px]` to keep colons pinned. All three cells use `!border-0` to suppress table borders. This is the defining structural trait of this variant.

Compare to `quotation_non_vat_no_vat_tin` which uses simple label: value pairs without strict column alignment.

## VAT TIN Presence

Unlike `quotation_non_vat_no_vat_tin`, this variant:
- Displays VAT TIN in the **header**: "លេខអត្តសញ្ញាណកម្មអាករ (VAT TIN)৷ K003-902201968" in `font-bold`.
- Has a **VAT TIN row** in the customer info section (also with colon alignment).

## Totals Rows (in order)

1. សរុប / Sub Total
2. អាករលើតម្លៃបន្ថែម / VAT (10%)
3. សរុបបូកបញ្ចូលប្រាក់ដុល្លារ / Grand Total in Dollar

Terms block: colspan=3, rowspan=3. Same warranty/returns text as other quotation variants.

## Signature Section

"Prepared By" (left) and "Approved By" (right). `mt-auto`. No Khmer labels. 11px bold.

## Table Border Scope

Unlike invoice variants that scope `table.items-table th, td`, this variant applies `th, td { border: 1px solid #000 }` globally, then overrides with `!border-0` on the metadata table cells. This is a minor CSS specificity risk if styles bleed — noted for future refactoring.

## Print Behavior

Same as all variants: `print-color-adjust: exact`, white bg, no shadow at print.
