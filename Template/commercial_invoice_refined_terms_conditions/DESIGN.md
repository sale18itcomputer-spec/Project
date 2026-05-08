---
name: Commercial Invoice — Refined Terms & Conditions
design_system: Material Design 3 (MD3) via Tailwind config
colors:
  primary: '#000000'
  on-primary: '#ffffff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  surface: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ffffff'
  surface-container: '#ffffff'
  surface-container-high: '#ffffff'
  surface-container-highest: '#ffffff'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  outline: '#76777d'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  tertiary-container: '#0b1c30'
  on-tertiary: '#ffffff'
  inverse-surface: '#2d3133'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
typography:
  body-main:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '400'
  body-strong:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '700'
    class: font-body-strong
  totals-label:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '700'
    note: whitespace-nowrap, text-right, pr-2
  terms-text:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '400'
  terms-heading:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '700'
    decoration: underline uppercase
spacing:
  margin-a4: p-8
  signature-margin: mt-16 px-16 pb-8
  terms-padding: p-4
---

## Variant Overview

Commercial invoice with MD3 token system (same as `commercial_invoice_non_vat_no_vat_tin`) but with a **reorganized totals block** that leads with Deposit and ends with Grand Total in Riel. No VAT row. No No VAT TIN. Includes sample data.

## Key Difference vs. `commercial_invoice_non_vat_no_vat_tin`

The totals row order is restructured to show balance-forward flow:

| Variant | Totals Order |
|---|---|
| non_vat | Grand Total → Deposit → Balance Due → Balance Due in Riel |
| refined_terms | Deposit → Sub Total → Exchange Rate → Grand Total in Riel |

`refined_terms` removes the explicit "Balance Due" row and instead shows Sub Total (post-deposit) → Exchange Rate → Riel total. This is more compact but removes the explicit balance due in USD which some customers expect.

Also: the terms text content is identical but the surrounding wrapper uses `space-y-4` on the outer div (consistent with `non_vat`).

## Totals Rows (in order)

1. ប្រាក់កក់ / Deposit
2. សរុប / Sub Total
3. អត្រាប្តូរប្រាក់ / Exchange Rate
4. សរុបរួមជាប្រាក់រៀល / Grand Total in Riel

Note: No explicit "Grand Total in USD" row. Sub Total here represents the post-deposit balance (USD), not a pre-discount subtotal.

## Design System

Same full MD3 token config as `commercial_invoice_non_vat_no_vat_tin`. Same Material Symbols font import. All surface containers map to `#ffffff`.

## Signature Section

Same as `commercial_invoice_non_vat_no_vat_tin`: bilingual Customer + Seller, `mt-16 px-16 pb-8`.

## Print Behavior

Same as all variants.
