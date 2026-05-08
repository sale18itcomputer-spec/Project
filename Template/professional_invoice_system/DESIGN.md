---
name: Professional Invoice System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b1c30'
  on-tertiary-container: '#75859d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1-display:
    fontFamily: Koh Santepheap
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  h2-section:
    fontFamily: Koh Santepheap
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.4'
    letterSpacing: 0.02em
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
  label-caps:
    fontFamily: Koh Santepheap
    fontSize: 9px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  table-header:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1.4'
  metadata:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '400'
    lineHeight: '1.4'
spacing:
  margin-a4: 20mm
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1.5rem
  stack-lg: 3rem
---

## Brand & Style

The design system is engineered for high-stakes financial documentation where clarity and authority are paramount. It targets professional services, legal entities, and corporate finance departments that require a bridge between digital efficiency and traditional print standards.

The aesthetic follows a **Corporate Modern** philosophy with a heavy lean toward **Minimalism**. By stripping away decorative elements, the design system ensures that the information hierarchy remains the protagonist. The emotional response is one of reliability, meticulousness, and transparency. Every element is optimized for A4 dimensions, ensuring that the transition from a digital screen to a physical printout maintains the integrity of the layout and the legibility of the data.

## Colors

This design system utilizes a palette rooted in deep navy and professional blue to evoke trust. Since the primary output is an A4 document, the system defaults to a **Light Mode** to minimize ink consumption and maximize contrast.

- **Primary (#0F172A):** Used for headlines, total amounts, and primary branding elements. It provides the "Black" anchor for the design.
- **Secondary (#2563EB):** Reserved for subtle accents, digital-only interactive elements, or highlighting the "Amount Due" to draw immediate attention.
- **Tertiary (#64748B):** A muted slate used for secondary information like metadata labels (e.g., "Invoice Date," "Tax ID") to prevent visual clutter.
- **Neutral (#F8FAFC):** Used for alternating table row fills and background sectioning to guide the eye without the need for heavy borders.

## Typography

The design system exclusively employs **Koh Santepheap**, a typeface that balances traditional serif structures with modern clarity. This choice ensures that numerical data is easy to parse and that the document feels like a formal record.

Typography is scaled specifically for A4 readability. Headlines use bold weights to anchor the document, while body text is set at 11px to allow for high data density without sacrificing legibility. Label styles use all-caps and increased letter spacing to differentiate field headers from the data itself. Line heights are kept tight for headers but generous for body text to ensure line items in a long invoice are distinct.

## Layout & Spacing

The layout is governed by a **Fixed Grid** optimized for a standard 210mm x 297mm (A4) canvas. It utilizes a 12-column grid system to provide flexibility for varied content like "Bill To" and "Ship To" columns, while maintaining a strict 20mm margin on all sides to accommodate office printers and hole-punching.

Spacing follows an 8pt rhythm to maintain vertical consistency. Large gaps (stack-lg) are used to separate the document header from the line items, while tight spacing (stack-sm) keeps related data points—like a label and its corresponding value—unified.

## Elevation & Depth

To maintain a professional and print-friendly profile, the design system avoids shadows and blurs. Instead, it utilizes **Tonal Layers** and **Low-Contrast Outlines**.

Depth is created through the strategic use of light gray fills (Neutral) for table headers and total summaries. These distinct backgrounds separate the "actionable" financial data from the rest of the document. Fine 0.5pt lines in Tertiary colors are used to separate sections, providing a structural skeleton that feels architectural and firm rather than soft.

## Shapes

This design system uses a **Sharp (0)** shape language. All containers, table rows, and decorative accents feature 90-degree corners. This decision reinforces the formal, institutional nature of an invoice. The lack of rounded corners ensures that the document feels rigid and serious, aligned with the precision expected in financial accounting.

## Components

### Invoice Table
The core component. It features a solid Primary color top border (2px). Headers are set in the `table-header` style with a light Neutral background. Line items utilize a thin 0.5pt bottom border for separation.

### Total Summary Block
Located at the bottom right, this block uses a subtle Neutral fill to highlight the "Balance Due." The final total is rendered in `h1-display` using the Primary color to ensure it is the most prominent element on the page.

### Status Chips
For digital views, chips use high-contrast backgrounds (e.g., solid Secondary blue for "Paid") with sharp corners. For print, these should be rendered as outlined boxes to save ink.

### Information Groupings
Pairs of `label-caps` (Tertiary) and `body-main` (Primary) are used for "Bill To," "Invoice Number," and "Due Date" sections. These should be aligned to the grid to create clear vertical scan lines.

### Signature & Terms
Footer components are set in `metadata` size. The signature line is a simple 1pt Primary color rule. This section is pushed to the bottom of the A4 layout to ensure it remains consistent across multi-page documents.