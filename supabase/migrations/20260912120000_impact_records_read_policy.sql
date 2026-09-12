create policy "Authenticated users can read impact records"
on public.impact_records
for select
to authenticated
using (true);
