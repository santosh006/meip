create policy "Public users can read entities"
on public.entities
for select
to anon
using (true);
