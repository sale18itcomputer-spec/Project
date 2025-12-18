-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: pipelines
create table public.pipelines (
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

-- Table: companies (Company List)
create table public.companies (
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

-- Table: contacts (Contact_List)
create table public.contacts (
  "Customer ID" text primary key,
  "Created Date" timestamp with time zone default now(),
  "Company Name" text,
  "Name" text,
  "Name (Khmer)" text,
  "Role" text,
  "Department" text,
  "Tel (1)" text,
  "Tel (2)" text,
  "Email" text,
  "Address (English)" text,
  "Address (Khmer)" text,
  "Created By" text,
  "Remarks" text
);

-- Table: contact_logs
create table public.contact_logs (
  "Log ID" text primary key default uuid_generate_v4()::text,
  "Type" text,
  "Company Name" text,
  "Contact Name" text,
  "Position" text,
  "Phone Number" text,
  "Email" text,
  "Responsible By" text,
  "Contact Date" timestamp with time zone default now(),
  "Counter" text,
  "Remarks" text
);

-- Table: meeting_logs
create table public.meeting_logs (
  "Meeting ID" text primary key default uuid_generate_v4()::text,
  "Type" text,
  "Pipeline_ID" text,
  "Company Name" text,
  "Participants" text,
  "Responsible By" text,
  "Meeting Date" timestamp with time zone,
  "Start Time" text,
  "End Time" text,
  "Status" text,
  "Remarks" text
);

-- Table: site_survey_logs
create table public.site_survey_logs (
  "Site ID" text primary key default uuid_generate_v4()::text,
  "Location" text,
  "Responsible By" text,
  "Date" timestamp with time zone,
  "Start Time" text,
  "End Time" text,
  "Remark" text,
  "Next Action (If Any)" text
);

-- Table: quotations
create table public.quotations (
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

-- Table: sale_orders
create table public.sale_orders (
  "SO No." text primary key,
  "SO Date" timestamp with time zone default now(),
  "File" text,
  "Quote No." text,
  "Company Name" text,
  "Contact Name" text,
  "Phone Number" text,
  "Email" text,
  "Tax" numeric,
  "Total Amount" numeric,
  "Commission" numeric,
  "Status" text,
  "Delivery Date" timestamp with time zone,
  "Payment Term" text,
  "Bill Invoice" text,
  "Install Software" text,
  "Created By" text,
  "Currency" text,
  "Attachment" text,
  "ItemsJSON" jsonb
);

-- Table: pricelist (Raw)
create table public.pricelist (
  "Item Code" text primary key,
  "Brand" text,
  "Model" text,
  "Item Description" text,
  "SRP" numeric,
  "SRP (B)" numeric,
  "Qty" numeric,
  "OTW" numeric,
  "Category" text,
  "Detail Spec" text,
  "Status" text,
  "Currency" text
);

-- Table: users (Application Users)
create table public.users (
  "UserID" text primary key,
  "Name" text,
  "Role" text,
  "Picture" text,
  "Password" text,
  "Email" text,
  "Status" text,
  "Phone 1" text,
  "Phone 2" text
);

-- Enable RLS (Row Level Security) - Optional but recommended
alter table public.pipelines enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_logs enable row level security;
alter table public.meeting_logs enable row level security;
alter table public.site_survey_logs enable row level security;
alter table public.quotations enable row level security;
alter table public.sale_orders enable row level security;
alter table public.pricelist enable row level security;
alter table public.users enable row level security;

-- Create policies (Simplest: Allow local access or authenticated access)
-- For now, allowing public access to verify migration, but in production, restrictt access
create policy "Enable read access for all users" on public.pipelines for select using (true);
create policy "Enable insert access for all users" on public.pipelines for insert with check (true);
create policy "Enable update access for all users" on public.pipelines for update using (true);
create policy "Enable delete access for all users" on public.pipelines for delete using (true);

-- Repeat policies for other tables as needed or keep RLS off during dev
