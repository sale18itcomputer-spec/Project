
-- 1. Create the 'attachments' bucket if it doesn't exist
insert into storage.buckets (id, name, public) 
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 2. Enable RLS allowing access to this bucket
-- Policy for SELECT (Read)
create policy "Allow Public Read"
on storage.objects for select
using ( bucket_id = 'attachments' );

-- Policy for INSERT (Upload)
create policy "Allow Public Upload"
on storage.objects for insert
with check ( bucket_id = 'attachments' );

-- Policy for UPDATE
create policy "Allow Public Update"
on storage.objects for update
using ( bucket_id = 'attachments' );

-- Policy for DELETE
create policy "Allow Public Delete"
on storage.objects for delete
using ( bucket_id = 'attachments' );
