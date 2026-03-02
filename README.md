# Limperial Project Dashboard

A full-featured internal CRM, sales, and project management dashboard built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Supabase**.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + Radix UI
- **Database**: Supabase (PostgreSQL)
- **Charts**: ECharts, ApexCharts
- **PDF**: jsPDF, pdfmake

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env` and set your environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Available Routes

| Route | Description |
|---|---|
| `/` | Main dashboard |
| `/projects` | Pipeline / Kanban |
| `/companies` | Company CRM |
| `/contacts` | Contacts |
| `/quotations` | Quotation management |
| `/sale-orders` | Sale orders |
| `/invoice-do` | Invoices & Delivery Orders |
| `/pricelist` | Product pricelist |
| `/vendors` | Vendor master |
| `/purchase-orders` | Purchase orders |

## Scripts

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```
