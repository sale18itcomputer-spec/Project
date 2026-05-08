---
name: Commercial Invoice — Non-VAT, No VAT TIN
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
    class: font-body
  body-strong:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '700'
    class: font-body-strong
  table-data:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '400'
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
  margin-a4: p-8 (main container)
  signature-margin: mt-16 px-16 pb-8
  terms-padding: p-4
---

## Variant Overview

Premium commercial invoice using the full **Material Design 3 token system** injected via Tailwind config. Unlike the simpler tax/quotation variants that use plain `brand-blue` classes, this variant loads all MD3 surface/primary/secondary/tertiary color tokens. Also loads **Material Symbols Outlined** icon font (though icons may not be visibly used in the static template).

This is a **non-VAT, no VAT TIN** commercial invoice — no VAT row, no TIN displayed. Includes sample data (Samsung SSD) as placeholder content.

## Design System Distinction

This variant uses the same MD3 color palette as `professional_invoice_system/DESIGN.md`. Key difference: all surface containers map to `#ffffff` (pure white), making the MD3 surface hierarchy effectively flat. This is intentional for print-first A4 output.

Tailwind classes referencing MD3 tokens: `text-on-surface`, `font-body-strong`, `text-on-surface-variant`, etc.

## Totals Rows (in order)

1. សរុប / Grand Total
2. ប្រាក់កក់ / Deposit
3. ប្រាក់នៅសល់ / Balance Due
4. ប្រាក់នៅសល់ជាប្រាក់រៀល / Balance Due in Riel (x4,100)

Note: Grand Total comes **first**, then Deposit is subtracted to arrive at Balance Due. This order differs from `tax_invoice_updated_terms_payment_info` where Deposit appears first.

## Terms & Payment Block

Left cell colspan=3, rowspan=4. Uses `<ul class="list-disc list-inside">` (styled list) vs. paragraph text in quotation variants. Headings use `underline uppercase`.

Payment info: ABA Bank, LIMPERIAL TECHNOLOGY CO., LTD., Account 003 916 564.

## Signature Section

Customer (ហត្ថលេខា និងឈ្មោះអ្នកទិញ / Customer's Signature & Name) and Seller (ហត្ថលេខា និងឈ្មោះអ្នកលក់ / Seller's Signature & Name). Uses `mt-16 px-16 pb-8` — wider padding than the tax invoice variants (`px-4 pb-8`).

## Print Behavior

Same as all variants. `@media print`: white bg, no shadow, no padding.
