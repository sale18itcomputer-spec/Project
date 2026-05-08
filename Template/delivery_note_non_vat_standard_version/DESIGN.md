---
name: Delivery Note — Non-VAT, Standard Version
design_system: Material Design 3 (MD3) via Tailwind config + brand-blue override
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
  error: '#ba1a1a'
  background: '#ffffff'
  on-background: '#191c1e'
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
    fontSize: varies
    fontWeight: '700'
    note: Document title — "លិខិតដឹក / DELIVERY NOTE"
  body-main:
    fontFamily: Koh Santepheap
    fontSize: 11px
    fontWeight: '400'
  notice-text:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '700'
    color: text-error (#ba1a1a)
    note: Delivery problem contact notice — bilingual
  checkbox-label:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '400'
  signature-label:
    fontFamily: Koh Santepheap
    fontSize: 10px
    fontWeight: '400'/'700'
spacing:
  margin-a4: p-8 (via Tailwind default)
  signature-margin: mt-16 px-4 pb-8
---

## Variant Overview

Delivery note — no amounts, no totals. Tracks physical delivery of goods. Includes: item table (no price column), notice block, customer acceptance checkbox section, bilingual signature with date lines. Non-VAT, no VAT TIN in header.

## Document Purpose

Not a financial document. Contains only: item number, SKU/code, description, quantity, condition columns. No pricing data. The document is designed to be physically signed by the Receiver and Deliverer.

## Design System Notes

Uses MD3 token config via Tailwind, plus adds `brand-blue: #0056b3` as an explicit named color alongside the MD3 tokens. The `brand-blue` is used in the header border and checkbox accent (`text-brand-blue`).

Background is `#ffffff` (not `#f3f4f6`) — the page bg is white even in screen view, unlike invoice/quotation variants that use `bg-gray-100`.

## Document Title

Bilingual delivery note title. No explicit title style in Tailwind config (uses inline bold).

## Unique Sections (not in invoice/quotation variants)

### Notice Block
Centered, 10px, `text-error` (#ba1a1a bold). Khmer line + English line:
- "សូមផ្ដល់ពត៍មានចំពោះការខ្វះខាតផ្នែកសេវាដឹកជញ្ជូនទំនិញ"
- "Please call, in case of delivery's problem (+855 XXX XXX XXX)"

### Customer Acceptance Block
Bordered box (`border border-black p-4`). Three checkboxes (Tailwind Forms plugin `form-checkbox h-4 w-4`):
1. Checked & accepted all received goods are in good condition.
2. Received all goods as ordered.
3. Unaccepted.

### Signature Section
Two roles: **Receiver** (ហត្ថលេខា និងឈ្មោះអ្នកទទួល / Receiver's Signature & Name) and **Deliverer** (ហត្ថលេខា និងឈ្មោះអ្នកប្រគល់ / Deliverer's Signature & Name). Each has a date line: `Date: _____/_____/_______`.

## Print Behavior

`@media print`: `print-color-adjust: exact`, white bg. No `@page` rule — relies on browser print dialog for A4 sizing.
