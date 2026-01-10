
-- Enable RLS policies for all tables to allow public access (mimicking previous behavior)

-- Users
create policy "Enable all access for users" on public.users for all using (true) with check (true);

-- Companies
create policy "Enable all access for companies" on public.companies for all using (true) with check (true);

-- Contacts
create policy "Enable all access for contacts" on public.contacts for all using (true) with check (true);

-- Contact Logs
create policy "Enable all access for contact_logs" on public.contact_logs for all using (true) with check (true);

-- Meeting Logs
create policy "Enable all access for meeting_logs" on public.meeting_logs for all using (true) with check (true);

-- Site Survey Logs
create policy "Enable all access for site_survey_logs" on public.site_survey_logs for all using (true) with check (true);

-- Quotations
create policy "Enable all access for quotations" on public.quotations for all using (true) with check (true);

-- Sale Orders
create policy "Enable all access for sale_orders" on public.sale_orders for all using (true) with check (true);

-- Pricelist
create policy "Enable all access for pricelist" on public.pricelist for all using (true) with check (true);
