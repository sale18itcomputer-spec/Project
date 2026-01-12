-- Create B2B Tables
-- These tables mirror the B2C structure but are dedicated for B2B transactions

-- Table: b2b_companies (B2B Company List)
create table public.b2b_companies (
  "Company ID" text primary key,
  "Created Date" timestamp with time zone default now(),
  "Created By" text,
  "Company Name" text,
  "Company Name (Khmer)" text,
  "Phone Number" text,
  "Patent" text,
  "Payment Term" text,
  "Field" text,
  "Address (English)" text,
  "Address (Khmer)" text,
  "Email" text,
  "Website" text,
  "Patent File" text
);

-- Table: b2b_pipelines
create table public.b2b_pipelines (
  "Pipeline No." text primary key,
  "Company Name" text,
  "Contact Name" text,
  "Contact Number" text,
  "Email" text,
  "Require" text,
  "Type" text,
  "Brand 1" text,
  "Taxable" text,
  "Responsible By" text,
  "Status" text,
  "Created Date" timestamp with time zone default now(),
  "Time Frame" text,
  "Due Date" timestamp with time zone,
  "Inv Date" timestamp with time zone,
  "Quote" text,
  "Quote No." text,
  "Bid Value" numeric,
  "Invoice No." text,
  "SO No." text,
  "Remarks" text,
  "Conditional" text,
  "Currency" text
);

-- Table: b2b_quotations
create table public.b2b_quotations (
  "Quote No." text primary key,
  "File" text,
  "Quote Date" timestamp with time zone default now(),
  "Validity Date" timestamp with time zone,
  "Company Name" text,
  "Company Address" text,
  "Contact Name" text,
  "Contact Number" text,
  "Contact Email" text,
  "Amount" numeric,
  "CM" text,
  "Status" text,
  "Reason" text,
  "Payment Term" text,
  "Stock Status" text,
  "Created By" text,
  "Currency" text,
  "Prepared By" text,
  "Approved By" text,
  "Remark" text,
  "Terms and Conditions" text,
  "Prepared By Position" text,
  "Approved By Position" text,
  "Tax Type" text,
  "ItemsJSON" jsonb
);

-- Enable RLS (Row Level Security)
alter table public.b2b_companies enable row level security;
alter table public.b2b_pipelines enable row level security;
alter table public.b2b_quotations enable row level security;

-- Create policies (allowing authenticated access)
create policy "Enable read access for all users" on public.b2b_companies for select using (true);
create policy "Enable insert access for all users" on public.b2b_companies for insert with check (true);
create policy "Enable update access for all users" on public.b2b_companies for update using (true);
create policy "Enable delete access for all users" on public.b2b_companies for delete using (true);

create policy "Enable read access for all users" on public.b2b_pipelines for select using (true);
create policy "Enable insert access for all users" on public.b2b_pipelines for insert with check (true);
create policy "Enable update access for all users" on public.b2b_pipelines for update using (true);
create policy "Enable delete access for all users" on public.b2b_pipelines for delete using (true);

create policy "Enable read access for all users" on public.b2b_quotations for select using (true);
create policy "Enable insert access for all users" on public.b2b_quotations for insert with check (true);
create policy "Enable update access for all users" on public.b2b_quotations for update using (true);
create policy "Enable delete access for all users" on public.b2b_quotations for delete using (true);

-- Create indexes for better performance
create index idx_b2b_companies_name on public.b2b_companies("Company Name");
create index idx_b2b_pipelines_company on public.b2b_pipelines("Company Name");
create index idx_b2b_pipelines_status on public.b2b_pipelines("Status");
create index idx_b2b_quotations_company on public.b2b_quotations("Company Name");
create index idx_b2b_quotations_status on public.b2b_quotations("Status");
