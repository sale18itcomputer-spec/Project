-- Table: user_passcodes
create table if not exists public.user_passcodes (
  "UserID" text primary key references public.users("UserID") on delete cascade,
  "Passcode" text not null,
  "AutoLockTimeout" text default '1 hour',
  "IsWindowsHelloEnabled" boolean default false,
  "updated_at" timestamp with time zone default now()
);

-- Enable RLS
alter table public.user_passcodes enable row level security;

-- Create policies (Allow users to manage their own passcodes)
create policy "Users can manage their own passcodes"
  on public.user_passcodes
  for all
  using (auth.uid()::text = "UserID")
  with check (auth.uid()::text = "UserID");

-- If using service role or bypass for now as per previous schema style
create policy "Allow all for now"
  on public.user_passcodes
  for all
  using (true)
  with check (true);
