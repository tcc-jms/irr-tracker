begin;

alter table public.projects
  add column if not exists id text;

update public.projects
set id = coalesce(
  nullif(btrim(id), ''),
  nullif(btrim(project_data->>'id'), ''),
  gen_random_uuid()::text
)
where id is null or btrim(id) = '';

update public.projects
set project_data = jsonb_set(project_data, '{id}', to_jsonb(id), true)
where project_data->>'id' is distinct from id;

create unique index if not exists projects_id_key
  on public.projects (id);

alter table public.projects
  alter column id set not null;

commit;
