---
name: Delivery Note — Updated Bilingual Title
design_system: Material Design 3 (MD3) via Tailwind config + brand-blue + fontFamily aliases
colors:
  brand-blue: '#0056b3'
  primary: '#000000'
  on-primary: '#ffffff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  surface: '#ffffff'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  error: '#ba1a1a'
  background: '#ffffff'
  on-background: '#191c1e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
typography:
  h1-display:
    fontFamily: Koh Santepheap
    tailwindAlias: font-h1-display
    fontSize: 20px (text-xl)
    fontWeight: '700'
    note: Company name (Khmer)
  h2-section:
    fontFamily: Koh Santepheap
    tailwindAlias: font-h2-section
    fontSize: 18px (text-lg)
    fontWeight: '700'
    note: Company name (Latin)
  body-main:
    fontFamily: Koh Santepheap
    tailwindAlias: font-body-main
    fontSize: 11px
    fontWeight: '400'
  body-strong:
    fontFamily: Koh Santepheap
    tailwindAlias: font-body-strong
    fontSize: 11px
    fontWeight: '700'
  label-caps:
    fontFamily: Koh Santepheap
    tailwindAlias: font-label-caps
    fontSize: 9px
    fontWeight: '700'
    letterSpacing: 0.05em
  table-header:
    fontFamily: Koh Santepheap
    tailwindAlias: font-table-header
    fontSize: 10px
    fontWeight: '700'
  metadata:
    fontFamily: Koh Santepheap
    tailwindAlias: font-metadata
    fontSize: 10px
    fontWeight: '400'
spacing:
  margin-a4: px-[20mm] py-[15mm]
  signature-margin: mt-16 px-4 pb-8
  print-page: '@page { size: A4; margin: 0 }'
---

## Variant Overview

Updated delivery note that aligns with the `professional_invoice_system` typography system. Key additions over `delivery_note_non_vat_standard_version`: (1) `fontFamily` aliases registered in Tailwind config matching the DESIGN.md spec, (2) `@page { size: A4; margin: 0 }` for native print page sizing, (3) margin uses physical units `px-[20mm] py-[15mm]` instead of `p-8`, (4) VAT TIN displayed in header.

## Key Differences vs. `delivery_note_non_vat_standard_version`

| Feature | Standard | Updated |
|---|---|---|
| fontFamily in Tailwind config | No | Yes (all 6 aliases) |
| `@page` print rule | No | Yes — `size: A4; margin: 0` |
| A4 margin units | `p-8` (Tailwind) | `px-[20mm] py-[15mm]` (physical) |
| VAT TIN in header | No | Yes — K003-902201968 |
| `body` class | `bg-background` | `font-body-main text-on-surface bg-background py-10` |
| Container class | `.a4-container` | `.a4-container px-[20mm] py-[15mm]` |

## Typography Aliases in Tailwind

All 6 font aliases are declared in `fontFamily` config extension, all mapping to `['Koh Santepheap', 'sans-serif']`. This enables Tailwind classes like `font-body-main`, `font-h1-display`, `font-table-header` etc. These match the token names in `professional_invoice_system/DESIGN.md`.

## VAT TIN in Header

"លេខអត្តសញ្ញាណកម្មអតប (VAT TIN) : K003-902201968" — note: uses "អតប" (not "អាករ") and a space before the colon, unlike `quotation_vertically_aligned_colons` which uses "អាករ" and "৷" separator. This is an inconsistency to resolve.

## Shared Sections with Standard Version

Notice block (text-error), Customer acceptance checkboxes, Receiver/Deliverer signature with date lines — identical structure to `delivery_note_non_vat_standard_version`.

## Print Behavior

`@page { size: A4; margin: 0 }` declared — browser will force A4 without margin dialog. `@media print`: `box-shadow: none`, white bg, `width: 100%` on `.a4-container`. This is the most print-correct template in the collection.
