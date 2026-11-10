begin;

grant select, insert, update, delete
  on table public.projects
  to anon, authenticated;

drop policy if exists "Allow update for all" on public.projects;
create policy "Allow update for all"
  on public.projects
  for update
  to public
  using (true)
  with check (true);

drop policy if exists "Allow delete for all" on public.projects;
create policy "Allow delete for all"
  on public.projects
  for delete
  to public
  using (true);

commit;
