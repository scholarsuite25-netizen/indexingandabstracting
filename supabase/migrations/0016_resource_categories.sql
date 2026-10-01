-- LIS 815 LMS — 0016_resource_categories.sql
-- Resources had exactly one writer (the seed script) and no way to group them:
-- the learner page was one flat list ordered by kind. This gives every course a
-- managed list of categories, hangs each resource off one, and stores files
-- uploaded from the new admin screen in a private Storage bucket. Files that
-- ship in the repository keep using storage_path under docs/ untouched.
-- Safe to run more than once.

-- ============ Categories ============

create table if not exists public.resource_categories (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  position    integer not null default 0,
  status      text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, title)
);

create index if not exists resource_categories_course_idx
  on public.resource_categories (course_id, position);

-- ============ The two columns a managed resource needs ============

alter table public.resources
  add column if not exists category_id uuid references public.resource_categories (id) on delete set null;

-- Object name inside the private "resources" bucket. Null for the repository
-- files served from docs/, which keep their storage_path.
alter table public.resources
  add column if not exists upload_path text;

create index if not exists resources_category_idx on public.resources (category_id);

-- The generic updated_at trigger in 0001 only walks tables that existed then.
drop trigger if exists set_updated_at on public.resource_categories;
create trigger set_updated_at before update on public.resource_categories
  for each row execute function public.set_updated_at();

-- ============ Row-level security ============
-- 0003 turns RLS on for every table that existed at that point; a table added
-- later has to turn it on itself, or the policies below are decoration.

alter table public.resource_categories enable row level security;

drop policy if exists resource_categories_select on public.resource_categories;
create policy resource_categories_select on public.resource_categories
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = resource_categories.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists resource_categories_write on public.resource_categories;
create policy resource_categories_write on public.resource_categories
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

-- ============ The private bucket admin uploads land in ============
-- Only course staff may write to it; downloads go through /api/resources/[id],
-- which checks the row's own policy first and then issues a short-lived URL.

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 52428800)
on conflict (id) do nothing;

drop policy if exists resources_staff_write on storage.objects;
create policy resources_staff_write on storage.objects
  for all to authenticated
  using (bucket_id = 'resources' and public.is_admin())
  with check (bucket_id = 'resources' and public.is_admin());

-- ============ Put the seeded resources into categories ============
-- A fresh database has no rows to move, so this block does nothing there; on a
-- database that already has resources it fills the gap until the next seed run.

do $$
declare
  c record;
  cat_study uuid;
  cat_info uuid;
  cat_papers uuid;
begin
  for c in select id from public.courses loop
    insert into public.resource_categories (course_id, title, position) values
      (c.id, 'Study materials', 0),
      (c.id, 'Course information', 1),
      (c.id, 'Examination papers', 2)
    on conflict (course_id, title) do nothing;

    select id into cat_study from public.resource_categories
      where course_id = c.id and title = 'Study materials';
    select id into cat_info from public.resource_categories
      where course_id = c.id and title = 'Course information';
    select id into cat_papers from public.resource_categories
      where course_id = c.id and title = 'Examination papers';

    update public.resources set category_id = cat_study
      where course_id = c.id and category_id is null and kind = 'file';
    update public.resources set category_id = cat_info
      where course_id = c.id and category_id is null and kind = 'link';
    update public.resources set category_id = cat_papers
      where course_id = c.id and category_id is null and kind = 'exam_paper';
  end loop;
end;
$$;
