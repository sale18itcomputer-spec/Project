---
name: Tax Invoice — Non-VAT, No VAT TIN
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
    lineHeight: '1.3'
    note: Company name (Khmer)
  h2-section:
    fontFamily: Koh Santepheap
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.3'
    note: Company name (Latin)
  doc-title:
    fontFamily: Koh Santepheap
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.4'
    note: Document title bilingual (វិក្កយបត្រ / INVOICE)
  body-main:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.6'
  body-strong:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.6'
  table-header:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.4'
  metadata-sm:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '400'
    lineHeight: '1.4'
  metadata-xs:
    fontFamily: Koh Santepheap
    fontSize: 8px
    fontWeight: '400'
    lineHeight: '1.4'
    note: Latin address line (whitespace-nowrap)
spacing:
  margin-a4: 32px (p-8 / ~8mm equivalent in screen rendering)
  stack-sm: 2px
  stack-md: 1.5rem
  stack-lg: 6 (mb-6)
---

## Variant Overview

Standard tax invoice for non-VAT-registered entities. Does not display a VAT TIN field. Issued by Limperial Technology Co., Ltd. Bilingual throughout (Khmer + English). Intended for both screen display and A4 print.

## Brand & Style

Corporate Minimal. No decorative elements. The brand-accent blue (`#0056b3`) is used structurally — as the header underline border and table outline — not decoratively. All body text is black on white.

The document emits formal institutional authority through tight spacing, full-border item tables, and bilingual titling.

## Colors

- **Brand Accent (#0056b3):** Header bottom border (3px), table borders conceptually map to `border-brand-blue`. Used sparingly to signal structure, not style.
- **Black (#000000):** All text and table cell borders (`border: 1px solid #000`).
- **White (#ffffff):** Page background within the A4 container.
- **Gray (#f3f4f6):** Screen-only page background (`bg-gray-100`) behind the A4 container.

## Typography

Exclusively **Koh Santepheap** (Google Fonts). Supports Khmer script natively.

- Company name rendered at 20px (Khmer) and 18px (Latin) bold.
- Document title (វិក្កយបត្រ / INVOICE) at 20px/18px bold, centered.
- Address has two lines: Khmer at 10px, Latin at 8px (`whitespace-nowrap`).
- Table headers and body both use 11px to maximize data density.
- Metadata labels (Invoice No, Date, Customer) use `body-main` with bold labels.

## Layout & Spacing

Fixed A4 canvas: `w-[210mm]`, `min-height: 297mm`. Centered on screen with `shadow-lg`. Padding `p-8` on all sides.

Header section: logo (absolute top-left), company info (centered), underlined with 3px brand-accent border.

Below header: centered document title block (bilingual). Then a two-column metadata row (invoice details left, customer info right). Then the full-width items table. Then totals block (right-aligned). Footer with payment instructions and signature line.

## Tables

`border-collapse: collapse`. All cells: `border: 1px solid #000`, `padding: 4px 8px`. Headers use `font-weight: 700`. No alternating row fills — relies on cell borders for separation. This is a deliberate print-friendly choice.

## Non-VAT Specifics

- No VAT TIN displayed in header or footer.
- No VAT row in totals block.
- No VAT disclaimer text.
- Totals: Subtotal → Discount (if any) → Grand Total only.

## Print Behavior

`@media print`: `print-color-adjust: exact`, `background-color: white`, `padding: 0`, `box-shadow: none`. The gray screen background and shadow are screen-only affordances stripped at print time.
