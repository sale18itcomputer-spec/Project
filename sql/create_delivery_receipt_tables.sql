-- Migration: Create delivery_orders and receipts tables
-- Run date: 2026-05-04
-- These tables complete the sales document flow:
-- Quotation → Sale Order → Invoice → Delivery Order + Receipt

-- ============================================================
-- delivery_orders
-- ============================================================
create table if not exists public.delivery_orders (
  "DO No"                  text primary key,
  "DO Date"                timestamp with time zone default now(),
  "Inv No"                 text,                          -- FK ref to invoices."Inv No"
  "SO No"                  text,                          -- FK ref to sale_orders."SO No"
  "Company Name"           text,
  "Company Address"        text,
  "Contact Name"           text,
  "Phone Number"           text,
  "Email"                  text,
  "Currency"               text,
  "Status"                 text default 'Pending',        -- Pending | Delivered | Cancelled
  "Payment Term"           text,
  "Delivery Date"          timestamp with time zone,
  "Prepared By"            text,
  "Approved By"            text,
  "Prepared By Position"   text,
  "Approved By Position"   text,
  "Remark"                 text,
  "Terms and Conditions"   text,
  "File"                   text,
  "Created By"             text,
  "ItemsJSON"              jsonb,
  "created_at"             timestamp with time zone default now(),
  "updated_at"             timestamp with time zone default now()
);

alter table public.delivery_orders enable row level security;

create policy "Enable read access for all users"   on public.delivery_orders for select using (true);
create policy "Enable insert access for all users" on public.delivery_orders for insert with check (true);
create policy "Enable update access for all users" on public.delivery_orders for update using (true);
create policy "Enable delete access for all users" on public.delivery_orders for delete using (true);


-- ============================================================
-- receipts
-- ============================================================
create table if not exists public.receipts (
  "RV No"                  text primary key,
  "RV Date"                timestamp with time zone default now(),
  "Inv No"                 text,                          -- FK ref to invoices."Inv No"
  "SO No"                  text,                          -- FK ref to sale_orders."SO No"
  "DO No"                  text,                          -- FK ref to delivery_orders."DO No"
  "Company Name"           text,
  "Company Address"        text,
  "Contact Name"           text,
  "Phone Number"           text,
  "Email"                  text,
  "Amount"                 numeric,
  "Currency"               text,
  "Payment Method"         text,                          -- Cash | Bank Transfer | Cheque | ABA | KHQR | Other
  "Tax Type"               text,                          -- VAT | NON-VAT
  "Status"                 text default 'Draft',          -- Draft | Issued | Cancelled
  "Payment Term"           text,
  "Tin No"                 text,
  "Prepared By"            text,
  "Approved By"            text,
  "Prepared By Position"   text,
  "Approved By Position"   text,
  "Remark"                 text,
  "Terms and Conditions"   text,
  "File"                   text,
  "Created By"             text,
  "ItemsJSON"              jsonb,
  "created_at"             timestamp with time zone default now(),
  "updated_at"             timestamp with time zone default now()
);

alter table public.receipts enable row level security;

create policy "Enable read access for all users"   on public.receipts for select using (true);
create policy "Enable insert access for all users" on public.receipts for insert with check (true);
create policy "Enable update access for all users" on public.receipts for update using (true);
create policy "Enable delete access for all users" on public.receipts for delete using (true);


-- ============================================================
-- Patch invoices: add missing columns to match other docs
-- ============================================================
alter table public.invoices
  add column if not exists "Prepared By"           text,
  add column if not exists "Approved By"           text,
  add column if not exists "Prepared By Position"  text,
  add column if not exists "Approved By Position"  text,
  add column if not exists "Tax Type"              text,
  add column if not exists "created_at"            timestamp with time zone default now(),
  add column if not exists "updated_at"            timestamp with time zone default now();
