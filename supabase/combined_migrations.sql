-- =========================================================================
-- MIGRATION: 0001_schema.sql
-- =========================================================================

-- LIS 815 LMS - 0001_schema.sql
-- Core schema: identity, course structure, learner state, assessments, theory exam,
-- content support, outcomes and platform tables. No RLS here: security lives in 0003.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ Identity and access ============

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  email        text,
  avatar_path  text,
  institution  text,
  bio          text,
  locale       text not null default 'en',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code in ('superadmin', 'admin', 'student')),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- ============ Course structure ============

create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  title           text not null,
  description     text,
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  enrolment_open  boolean not null default true,
  instructor_id   uuid references public.profiles (id) on delete set null,
  duration_weeks  int,
  version         int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table if not exists public.course_staff (
  course_id  uuid not null references public.courses (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  staff_role text not null default 'instructor' check (staff_role in ('owner', 'instructor', 'assistant')),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  position    int not null check (position > 0),
  title       text not null,
  description text,
  status      text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules (id) on delete cascade,
  position   int not null check (position > 0),
  title      text not null,
  slug       text not null,
  summary    text,
  status     text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position),
  unique (module_id, slug)
);

create table if not exists public.assessments (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses (id) on delete cascade,
  type                 text not null check (type in ('knowledge_check', 'objective', 'theory', 'practical')),
  title                text not null,
  description          text,
  duration_minutes     int check (duration_minutes > 0),
  max_attempts         int check (max_attempts > 0),
  pass_mark            int not null default 70 check (pass_mark between 0 and 100),
  randomize_questions  boolean not null default false,
  randomize_options    boolean not null default false,
  show_correct_answers boolean not null default true,
  available_from       timestamptz,
  available_until      timestamptz,
  prerequisite         text not null default 'all_lessons' check (prerequisite in ('all_lessons', 'none')),
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  settings             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.lessons (
  id                            uuid primary key default gen_random_uuid(),
  chapter_id                    uuid not null references public.chapters (id) on delete cascade,
  position                      int not null check (position > 0),
  title                         text not null,
  kind                          text not null default 'reading' check (kind in ('reading', 'check', 'practical')),
  is_required                   boolean not null default true,
  est_minutes                   int not null default 10 check (est_minutes > 0),
  required_reading_pct          int not null default 90 check (required_reading_pct between 1 and 100),
  min_seconds                   int not null default 0 check (min_seconds >= 0),
  required_assessment_id        uuid references public.assessments (id) on delete set null,
  required_assessment_min_score int not null default 70 check (required_assessment_min_score between 0 and 100),
  requires_approval             boolean not null default false,
  resume_anchor                 jsonb not null default '{}'::jsonb,
  status                        text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (chapter_id, position)
);

create table if not exists public.lesson_sections (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  position       int not null check (position > 0),
  kind           text not null default 'prose' check (kind in ('prose', 'example', 'formula', 'exercise', 'checkpoint', 'objectives')),
  title          text,
  content_md     text not null default '',
  is_required    boolean not null default true,
  estimated_words int not null default 0 check (estimated_words >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (lesson_id, position)
);

create table if not exists public.lesson_prerequisites (
  lesson_id             uuid not null references public.lessons (id) on delete cascade,
  prerequisite_lesson_id uuid not null references public.lessons (id) on delete cascade,
  primary key (lesson_id, prerequisite_lesson_id),
  check (lesson_id <> prerequisite_lesson_id)
);

create table if not exists public.reading_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  section_id uuid references public.lesson_sections (id) on delete cascade,
  pct        int not null default 0 check (pct between 0 and 100),
  seconds    int not null default 0 check (seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists reading_events_user_lesson_idx
  on public.reading_events (user_id, lesson_id, created_at desc);

-- ============ Learner state ============

create table if not exists public.course_enrollments (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  status              text not null default 'active' check (status in ('active', 'completed', 'dropped')),
  enrolled_at         timestamptz not null default now(),
  completed_at        timestamptz,
  progress_pct        numeric(5, 2) not null default 0 check (progress_pct between 0 and 100),
  required_lessons_done int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (course_id, user_id)
);

create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  reading_pct   int not null default 0 check (reading_pct between 0 and 100),
  seconds_spent int not null default 0 check (seconds_spent >= 0),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  completed_by  text not null default 'self' check (completed_by in ('self', 'approval')),
  last_section_id uuid references public.lesson_sections (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ============ Questions and objective attempts ============

create table if not exists public.question_banks (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, name)
);

create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  bank_id         uuid references public.question_banks (id) on delete cascade,
  assessment_id   uuid references public.assessments (id) on delete cascade,
  module_id       uuid references public.modules (id) on delete set null,
  chapter_id      uuid references public.chapters (id) on delete set null,
  stem_md         text not null,
  type            text not null default 'mcq' check (type in ('mcq', 'essay', 'short')),
  points          numeric(5, 2) not null default 1 check (points >= 0),
  explanation_md  text,
  model_answer_md text,
  source          text not null default 'lms-authored' check (source in ('supplied', 'lms-authored', 'supplementary')),
  source_ref      text,
  position        int not null default 0,
  status          text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists questions_assessment_position_idx
  on public.questions (assessment_id, position);
create index if not exists questions_bank_idx on public.questions (bank_id);
create index if not exists questions_chapter_idx on public.questions (chapter_id);

create table if not exists public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label       text not null check (label in ('A', 'B', 'C', 'D')),
  text        text not null,
  position    int not null default 0,
  is_correct  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (question_id, label)
);

create index if not exists question_options_question_idx
  on public.question_options (question_id, position);

create table if not exists public.assessment_attempts (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  attempt_no     int not null check (attempt_no > 0),
  status         text not null default 'in_progress'
                 check (status in ('in_progress', 'submitted', 'marked', 'expired')),
  started_at     timestamptz not null default now(),
  expires_at     timestamptz,
  submitted_at   timestamptz,
  marked_at      timestamptz,
  score          numeric(6, 2) check (score >= 0),
  total          numeric(6, 2) check (total >= 0),
  percentage     numeric(6, 2) check (percentage between 0 and 100),
  passed         boolean,
  question_order jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, assessment_id, attempt_no)
);

create unique index if not exists assessment_attempts_one_open_idx
  on public.assessment_attempts (user_id, assessment_id)
  where status = 'in_progress';

create index if not exists assessment_attempts_assessment_status_idx
  on public.assessment_attempts (assessment_id, status);

create table if not exists public.attempt_answers (
  id                uuid primary key default gen_random_uuid(),
  attempt_id        uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id       uuid not null references public.questions (id) on delete cascade,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct        boolean,
  answered_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ============ Theory examination ============

create table if not exists public.theory_submissions (
  id                   uuid primary key default gen_random_uuid(),
  assessment_id        uuid not null references public.assessments (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  selected_question_ids uuid[] not null default '{}',
  status               text not null default 'draft'
                       check (status in ('draft', 'submitted', 'under_review', 'graded', 'released')),
  started_at           timestamptz not null default now(),
  expires_at           timestamptz,
  submitted_at         timestamptz,
  graded_at            timestamptz,
  released_at          timestamptz,
  total_score          numeric(6, 2) check (total_score between 0 and 100),
  overall_feedback     text,
  graded_by            uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists theory_submissions_one_draft_idx
  on public.theory_submissions (user_id, assessment_id)
  where status = 'draft';

create index if not exists theory_submissions_status_idx
  on public.theory_submissions (status, submitted_at);

create table if not exists public.theory_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.theory_submissions (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  answer_text   text not null default '',
  word_count    int not null default 0 check (word_count >= 0),
  status        text not null default 'draft' check (status in ('not_selected', 'draft', 'graded')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (submission_id, question_id)
);

create table if not exists public.theory_grades (
  id              uuid primary key default gen_random_uuid(),
  theory_answer_id uuid not null unique references public.theory_answers (id) on delete cascade,
  score           numeric(5, 2) not null check (score between 0 and 20),
  feedback        text,
  graded_by       uuid references public.profiles (id) on delete set null,
  graded_at       timestamptz not null default now(),
  rubric_ref      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============ Content support ============

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  module_id   uuid references public.modules (id) on delete cascade,
  chapter_id  uuid references public.chapters (id) on delete cascade,
  lesson_id   uuid references public.lessons (id) on delete cascade,
  title       text not null,
  description text,
  kind        text not null default 'file' check (kind in ('file', 'link', 'exam_paper')),
  storage_path text,
  url         text,
  visibility  text not null default 'students' check (visibility in ('students', 'staff')),
  source      text not null default 'lms-authored' check (source in ('supplied', 'lms-authored', 'supplementary')),
  mime_type   text,
  size_bytes  bigint check (size_bytes >= 0),
  status      text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resources_course_idx on public.resources (course_id, visibility);

create table if not exists public.glossary_terms (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses (id) on delete cascade,
  term              text not null,
  slug              text not null,
  definition        text not null,
  module_id         uuid references public.modules (id) on delete set null,
  related_term_ids  uuid[] not null default '{}',
  example           text,
  notes             text,
  source            text not null default 'supplied' check (source in ('supplied', 'lms-authored', 'supplementary')),
  position          int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_id, slug)
);

create index if not exists glossary_terms_term_idx on public.glossary_terms (course_id, term);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  section_id uuid references public.lesson_sections (id) on delete set null,
  body       text not null,
  selection  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_lesson_idx on public.notes (user_id, lesson_id);

create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('lesson', 'glossary', 'resource')),
  ref_id     uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses (id) on delete cascade,
  title      text not null,
  body_md    text not null,
  audience   text not null default 'enrolled' check (audience in ('all', 'enrolled')),
  publish_at timestamptz not null default now(),
  status     text not null default 'published' check (status in ('draft', 'published', 'archived')),
  pinned     boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);

-- ============ Practical activities ============

create table if not exists public.practical_activities (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses (id) on delete cascade,
  chapter_id        uuid references public.chapters (id) on delete set null,
  title             text not null,
  instructions_md   text not null default '',
  rubric            jsonb not null default '{}'::jsonb,
  model_solution_md text,
  is_required       boolean not null default false,
  position          int not null default 0,
  status            text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.practical_submissions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.practical_activities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  body         text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'submitted', 'graded')),
  score        numeric(5, 2) check (score >= 0),
  feedback     text,
  graded_by    uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  graded_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (activity_id, user_id)
);

-- ============ Outcomes and platform ============

create table if not exists public.certificates (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  course_id           uuid not null references public.courses (id) on delete cascade,
  certificate_number  text not null unique,
  status              text not null default 'issued' check (status in ('issued', 'revoked')),
  issued_at           timestamptz not null default now(),
  completion_date     date not null default current_date,
  issued_by           uuid references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  revoked_reason      text,
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists certificates_one_active_idx
  on public.certificates (user_id, course_id)
  where status = 'issued';

create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_secret   boolean not null default false,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

create table if not exists public.search_index (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lesson', 'glossary', 'resource', 'announcement')),
  entity_id   uuid not null,
  course_id   uuid references public.courses (id) on delete cascade,
  title       text not null,
  body        text not null default '',
  title_tsv   tsvector,
  body_tsv    tsvector,
  updated_at  timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists search_index_title_tsv_idx on public.search_index using gin (title_tsv);
create index if not exists search_index_body_tsv_idx on public.search_index using gin (body_tsv);

create table if not exists public.rate_limits (
  bucket       text not null,
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (bucket, key, window_start)
);

-- ============ updated_at triggers for every table that has the column ============

do $$
declare
  t record;
begin
  for t in
    select distinct c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
      and a.attname = 'updated_at'
      and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t.relname);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t.relname
    );
  end loop;
end;
$$;


-- =========================================================================
-- MIGRATION: 0002_functions.sql
-- =========================================================================

-- LIS 815 LMS - 0002_functions.sql
-- Server-side rules: auth bootstrap, role helpers, reading/completion RPCs,
-- objective attempt lifecycle, theory 70% gate + exactly-5 rule, grading, certificates.

-- ============ Auth bootstrap ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.roles (code, name)
  values ('student', 'Student')
  on conflict (code) do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.code = 'student'
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Role and permission helpers (used inside RLS policies) ============

create or replace function public.current_user_roles()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(r.code), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'admin' = any (public.current_user_roles())
      or 'superadmin' = any (public.current_user_roles())
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'superadmin' = any (public.current_user_roles())
$$;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code = p_code
  )
$$;

create or replace function public.is_course_staff(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (
    select 1 from public.course_staff cs
    where cs.course_id = p_course_id
      and cs.user_id = auth.uid()
  )
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.course_enrollments ce
    where ce.course_id = p_course_id
      and ce.user_id = auth.uid()
      and ce.status in ('active', 'completed')
  )
$$;

create or replace function public.get_setting(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select * into v from public.system_settings where key = p_key;
  if not found then
    return 'null'::jsonb;
  end if;
  if v.is_secret and not public.is_admin() then
    return 'null'::jsonb;
  end if;
  return v.value;
end;
$$;

create or replace function public.get_setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(public.get_setting(p_key) #>> '{}', '')::int,
    p_default
  )
$$;

create or replace function public.log_audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
end;
$$;

create or replace function public.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

-- ============ Exactly one correct option per MCQ ============

-- A learner must not be able to read question_options (that table holds is_correct),
-- so any RLS policy that has to confirm an option belongs to a question has to ask
-- through a SECURITY DEFINER helper. A policy subquery is evaluated with the
-- caller's own permissions, which would make the check always fail for students.
create or replace function public.option_belongs_to_question(p_option_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.question_options qo
    where qo.id = p_option_id
      and qo.question_id = p_question_id
  );
$$;

create or replace function public.question_in_attempt(p_attempt_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.assessment_attempts a,
         lateral jsonb_array_elements_text(a.question_order) as qid(id)
    where a.id = p_attempt_id
      and qid.id::uuid = p_question_id
  );
$$;

create or replace function public.enforce_single_correct_option()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_correct then
    if exists (
      select 1 from public.question_options qo
      where qo.question_id = new.question_id
        and qo.is_correct
        and qo.id <> new.id
    ) then
      raise exception 'A question may have only one correct option (question %)', new.question_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_correct_option on public.question_options;
create trigger enforce_single_correct_option
  before insert or update on public.question_options
  for each row execute function public.enforce_single_correct_option();

-- ============ Lesson access and reading ============

create or replace function public.can_access_lesson(p_lesson_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_course_id uuid;
  v_status text;
begin
  select m.course_id, l.status
    into v_course_id, v_status
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    return false;
  end if;

  if public.is_course_staff(v_course_id) then
    return true;
  end if;

  if v_status <> 'published' then
    return false;
  end if;

  if not public.is_enrolled(v_course_id) then
    return false;
  end if;

  return not exists (
    select 1
    from public.lesson_prerequisites lp
    where lp.lesson_id = p_lesson_id
      and not exists (
        select 1 from public.lesson_progress lp2
        where lp2.lesson_id = lp.prerequisite_lesson_id
          and lp2.user_id = auth.uid()
          and lp2.status = 'completed'
      )
  );
end;
$$;

create or replace function public.record_reading_event(
  p_lesson_id uuid,
  p_pct int default 0,
  p_seconds int default 0,
  p_section_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id uuid;
  v_required int;
  v_new_pct int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.course_id, l.required_reading_pct
    into v_course_id, v_required
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found';
  end if;

  if not public.is_enrolled(v_course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Lesson is not accessible yet';
  end if;

  insert into public.reading_events (user_id, lesson_id, section_id, pct, seconds)
  values (v_user_id, p_lesson_id, p_section_id, least(greatest(p_pct, 0), 100), greatest(p_seconds, 0));

  insert into public.lesson_progress (user_id, lesson_id, reading_pct, seconds_spent)
  values (v_user_id, p_lesson_id, least(greatest(p_pct, 0), 100), greatest(p_seconds, 0))
  on conflict (user_id, lesson_id) do update
    set reading_pct = greatest(public.lesson_progress.reading_pct, least(greatest(p_pct, 0), 100)),
        seconds_spent = public.lesson_progress.seconds_spent + greatest(p_seconds, 0),
        last_section_id = coalesce(p_section_id, public.lesson_progress.last_section_id),
        updated_at = now();

  select reading_pct into v_new_pct
  from public.lesson_progress
  where user_id = v_user_id and lesson_id = p_lesson_id;

  return jsonb_build_object('reading_pct', v_new_pct, 'required_pct', v_required);
end;
$$;

-- ============ Objective attempts ============

create or replace function public.start_objective_attempt(p_assessment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
  v_open_id uuid;
  v_count int;
  v_next int;
  v_attempt_id uuid;
  v_order jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into a from public.assessments where id = p_assessment_id and status = 'published';
  if not found then
    raise exception 'Assessment not found or not published';
  end if;

  if a.type = 'theory' then
    raise exception 'Theory examinations are started with create_theory_submission()';
  end if;

  if a.available_from is not null and now() < a.available_from then
    raise exception 'Assessment is not open yet';
  end if;
  if a.available_until is not null and now() > a.available_until then
    raise exception 'Assessment is closed';
  end if;

  if not public.is_enrolled(a.course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  select id into v_open_id
  from public.assessment_attempts
  where user_id = v_user_id and assessment_id = p_assessment_id and status = 'in_progress';

  if v_open_id is not null then
    return v_open_id;
  end if;

  if a.prerequisite = 'all_lessons' then
    if exists (
      select 1
      from public.lessons l
      join public.chapters ch on ch.id = l.chapter_id
      join public.modules m on m.id = ch.module_id
      where m.course_id = a.course_id
        and l.is_required
        and l.status = 'published'
        and not exists (
          select 1 from public.lesson_progress lp
          where lp.lesson_id = l.id and lp.user_id = v_user_id and lp.status = 'completed'
        )
    ) then
      raise exception 'All required lessons must be completed before starting this assessment';
    end if;
  end if;

  select count(*) into v_count
  from public.assessment_attempts
  where user_id = v_user_id and assessment_id = p_assessment_id;

  if a.max_attempts is not null and v_count >= a.max_attempts then
    raise exception 'Maximum number of attempts reached (%)', a.max_attempts;
  end if;

  v_next := v_count + 1;

  if a.randomize_questions then
    select coalesce(jsonb_agg(to_jsonb(s.id) order by s.rnd), '[]'::jsonb)
    into v_order
    from (
      select q.id, random() as rnd
      from public.questions q
      where q.assessment_id = p_assessment_id
        and q.status = 'published'
    ) s;
  else
    select coalesce(jsonb_agg(to_jsonb(q.id) order by q.position), '[]'::jsonb)
    into v_order
    from public.questions q
    where q.assessment_id = p_assessment_id and q.status = 'published';
  end if;

  if jsonb_array_length(v_order) = 0 then
    raise exception 'Assessment has no published questions';
  end if;

  insert into public.assessment_attempts (assessment_id, user_id, attempt_no, expires_at, question_order)
  values (
    p_assessment_id,
    v_user_id,
    v_next,
    case when a.duration_minutes is not null then now() + (a.duration_minutes || ' minutes')::interval end,
    v_order
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

create or replace function public.submit_objective_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
  v_score numeric := 0;
  v_total numeric := 0;
  v_pct numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att
  from public.assessment_attempts
  where id = p_attempt_id and user_id = v_user_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.status <> 'in_progress' then
    raise exception 'Attempt is already submitted';
  end if;

  select * into a from public.assessments where id = att.assessment_id;

  if att.expires_at is not null and now() > att.expires_at then
    update public.assessment_attempts set status = 'expired', submitted_at = now() where id = p_attempt_id;
    raise exception 'Attempt has expired';
  end if;

  update public.attempt_answers aa
  set is_correct = coalesce(qo.is_correct, false)
  from public.question_options qo
  where qo.id = aa.selected_option_id
    and aa.attempt_id = p_attempt_id;

  update public.attempt_answers
  set is_correct = false
  where attempt_id = p_attempt_id
    and selected_option_id is null;

  select
    coalesce(sum(q.points), 0),
    coalesce(sum(case when aa.is_correct then q.points else 0 end), 0)
  into v_total, v_score
  from jsonb_array_elements_text(att.question_order) as ids(id)
  join public.questions q on q.id = ids.id::uuid
  left join public.attempt_answers aa on aa.attempt_id = p_attempt_id and aa.question_id = q.id;

  if v_total = 0 then
    v_pct := 0;
  else
    v_pct := round((v_score / v_total) * 100, 2);
  end if;

  update public.assessment_attempts
  set status = 'marked',
      submitted_at = now(),
      marked_at = now(),
      score = v_score,
      total = v_total,
      percentage = v_pct,
      passed = v_pct >= a.pass_mark
  where id = p_attempt_id;

  return jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'percentage', v_pct,
    'passed', v_pct >= a.pass_mark,
    'pass_mark', a.pass_mark
  );
end;
$$;

create or replace function public.best_objective_percentage(p_course_id uuid, p_user_id uuid default null)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select max(aa.percentage)
  from public.assessment_attempts aa
  join public.assessments a on a.id = aa.assessment_id
  where a.course_id = p_course_id
    and a.type = 'objective'
    and aa.user_id = coalesce(p_user_id, auth.uid())
    and aa.status = 'marked'
$$;

-- ============ Theory examination ============

create or replace function public.create_theory_submission(p_assessment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
  v_gate int;
  v_best numeric;
  v_open_id uuid;
  v_submission_id uuid;
  v_question record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into a from public.assessments where id = p_assessment_id and status = 'published';
  if not found then
    raise exception 'Assessment not found or not published';
  end if;
  if a.type <> 'theory' then
    raise exception 'Assessment is not a theory examination';
  end if;
  if not public.is_enrolled(a.course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  if a.available_from is not null and now() < a.available_from then
    raise exception 'Examination is not open yet';
  end if;

  v_gate := public.get_setting_int('theory_unlock_score', 70);
  v_best := coalesce(public.best_objective_percentage(a.course_id), 0);

  if v_best < v_gate then
    raise exception 'Theory examination unlocks at % percent on the objective assessment (best: %)', v_gate, v_best;
  end if;

  select id into v_open_id
  from public.theory_submissions
  where user_id = v_user_id and assessment_id = p_assessment_id and status = 'draft';

  if v_open_id is not null then
    return v_open_id;
  end if;

  if a.available_until is not null and now() > a.available_until then
    raise exception 'Examination is closed';
  end if;

  insert into public.theory_submissions (assessment_id, user_id, expires_at)
  values (
    p_assessment_id,
    v_user_id,
    case when a.duration_minutes is not null then now() + (a.duration_minutes || ' minutes')::interval end
  )
  returning id into v_submission_id;

  for v_question in
    select id from public.questions
    where assessment_id = p_assessment_id and status = 'published'
    order by position
  loop
    insert into public.theory_answers (submission_id, question_id, status)
    values (v_submission_id, v_question.id, 'not_selected');
  end loop;

  return v_submission_id;
end;
$$;

create or replace function public.select_theory_questions(
  p_submission_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  v_count int;
  v_valid int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s
  from public.theory_submissions
  where id = p_submission_id and user_id = v_user_id;

  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status <> 'draft' then
    raise exception 'Submission is not editable';
  end if;
  if coalesce(array_length(p_question_ids, 1), 0) <> 5 then
    raise exception 'You must select exactly 5 questions';
  end if;
  if (select count(distinct id) from unnest(p_question_ids) as id) <> 5 then
    raise exception 'Duplicate questions in selection';
  end if;

  select count(*) into v_valid
  from public.questions q
  where q.id = any (p_question_ids)
    and q.assessment_id = s.assessment_id;

  if v_valid <> 5 then
    raise exception 'Selection contains questions that are not part of this examination';
  end if;

  update public.theory_answers
  set status = case when question_id = any (p_question_ids) then 'draft' else 'not_selected' end,
      updated_at = now()
  where submission_id = p_submission_id;

  update public.theory_submissions
  set selected_question_ids = p_question_ids
  where id = p_submission_id;
end;
$$;

create or replace function public.submit_theory_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  v_selected int;
  v_empty int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s
  from public.theory_submissions
  where id = p_submission_id and user_id = v_user_id;

  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status <> 'draft' then
    raise exception 'Submission is not editable';
  end if;
  if s.expires_at is not null and now() > s.expires_at then
    update public.theory_submissions set status = 'submitted', submitted_at = now() where id = p_submission_id;
    raise exception 'Time has expired';
  end if;

  select count(*) into v_selected
  from public.theory_answers
  where submission_id = p_submission_id and status = 'draft';

  if v_selected <> 5 then
    raise exception 'You must answer exactly 5 questions (currently %)', v_selected;
  end if;

  select count(*) into v_empty
  from public.theory_answers
  where submission_id = p_submission_id and status = 'draft'
    and btrim(answer_text) = '';

  if v_empty > 0 then
    raise exception 'Every selected question needs an answer before submitting';
  end if;

  update public.theory_submissions
  set status = 'submitted',
      submitted_at = now(),
      selected_question_ids = coalesce(
        (select array_agg(question_id)
         from public.theory_answers
         where submission_id = p_submission_id and status = 'draft'),
        '{}'::uuid[]
      )
  where id = p_submission_id;
end;
$$;

create or replace function public.grade_theory_answer(
  p_theory_answer_id uuid,
  p_score numeric,
  p_feedback text default null,
  p_rubric_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid;
  v_total numeric;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to grade';
  end if;

  if p_score < 0 or p_score > 20 then
    raise exception 'Score must be between 0 and 20';
  end if;

  select submission_id into v_submission_id
  from public.theory_answers
  where id = p_theory_answer_id;

  if v_submission_id is null then
    raise exception 'Theory answer not found';
  end if;

  insert into public.theory_grades (theory_answer_id, score, feedback, graded_by, rubric_ref)
  values (p_theory_answer_id, p_score, p_feedback, auth.uid(), p_rubric_ref)
  on conflict (theory_answer_id) do update
    set score = excluded.score,
        feedback = excluded.feedback,
        graded_by = excluded.graded_by,
        rubric_ref = excluded.rubric_ref,
        graded_at = now();

  update public.theory_answers
  set status = 'graded', updated_at = now()
  where id = p_theory_answer_id;

  select coalesce(sum(g.score), 0)
  into v_total
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = v_submission_id;

  update public.theory_submissions
  set total_score = v_total,
      graded_at = now(),
      status = case
        when status in ('graded', 'released') then status
        else 'graded'
      end
  where id = v_submission_id;

  perform public.log_audit('theory.answer_graded', 'theory_answers', p_theory_answer_id::text, null, jsonb_build_object('score', p_score));
end;
$$;

create or replace function public.release_theory_grade(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_passed int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to release grades';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status not in ('graded', 'released') then
    raise exception 'Submission must be graded before release';
  end if;

  v_passed := public.get_setting_int('theory_pass_mark', 50);

  update public.theory_submissions
  set status = 'released', released_at = now()
  where id = p_submission_id;

  perform public.notify(
    s.user_id,
    'grade_released',
    'Theory examination graded',
    case when coalesce(s.total_score, 0) >= v_passed then 'You passed.' else 'Result available in your assessment history.' end,
    '/dashboard/assessments'
  );

  perform public.log_audit('theory.released', 'theory_submissions', p_submission_id::text, null, null);
end;
$$;

-- ============ Progress, enrolment, certificate ============

create or replace function public.mark_lesson_complete(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_lesson record;
  v_progress record;
  v_course_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    l.id, l.chapter_id, l.kind, l.is_required, l.required_reading_pct,
    l.required_assessment_id, l.required_assessment_min_score, l.requires_approval,
    m.course_id
  into v_lesson
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where l.id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found';
  end if;

  v_course_id := v_lesson.course_id;

  if not public.is_enrolled(v_course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Complete the prerequisite lessons first';
  end if;

  select * into v_progress
  from public.lesson_progress
  where user_id = v_user_id and lesson_id = p_lesson_id;

  if v_progress is null then
    insert into public.lesson_progress (user_id, lesson_id)
    values (v_user_id, p_lesson_id)
    returning * into v_progress;
  end if;

  if v_lesson.requires_approval then
    raise exception 'This lesson requires instructor approval';
  end if;

  if v_lesson.kind = 'reading' and v_progress.reading_pct < v_lesson.required_reading_pct then
    raise exception 'Read at least % percent of the lesson before marking it complete (currently % percent)',
      v_lesson.required_reading_pct, v_progress.reading_pct;
  end if;

  if v_lesson.required_assessment_id is not null then
    if coalesce((
      select max(aa.percentage)
      from public.assessment_attempts aa
      where aa.assessment_id = v_lesson.required_assessment_id
        and aa.user_id = v_user_id
        and aa.status = 'marked'
    ), 0) < v_lesson.required_assessment_min_score then
      raise exception 'Pass the knowledge check for this lesson first (% percent required)', v_lesson.required_assessment_min_score;
    end if;
  end if;

  update public.lesson_progress
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      completed_by = 'self'
  where user_id = v_user_id and lesson_id = p_lesson_id;

  v_result := public.recompute_enrollment_progress(v_course_id, v_user_id);

  perform public.log_audit('lesson.completed', 'lessons', p_lesson_id::text, null, null);

  return v_result;
end;
$$;

create or replace function public.recompute_enrollment_progress(p_course_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_done int;
  v_pct numeric;
  v_theory_pass int;
  v_best_theory numeric;
  v_best_objective numeric;
  v_objective_pass int;
  v_result jsonb;
begin
  select count(*) into v_total
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where m.course_id = p_course_id
    and l.is_required
    and l.status = 'published';

  select count(*) into v_done
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where m.course_id = p_course_id
    and lp.user_id = p_user_id
    and l.is_required
    and l.status = 'published'
    and lp.status = 'completed';

  v_pct := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100, 2) end;

  update public.course_enrollments
  set progress_pct = v_pct,
      required_lessons_done = v_done,
      status = case when v_pct = 100 and status = 'active' then 'completed' else status end,
      completed_at = case when v_pct = 100 and completed_at is null then now() else completed_at end
  where course_id = p_course_id and user_id = p_user_id;

  v_theory_pass := public.get_setting_int('theory_pass_mark', 50);
  v_objective_pass := public.get_setting_int('objective_pass_mark', 50);

  select coalesce(max(ts.total_score), 0) into v_best_theory
  from public.theory_submissions ts
  where ts.assessment_id in (
      select id from public.assessments where course_id = p_course_id and type = 'theory'
    )
    and ts.user_id = p_user_id
    and ts.status in ('graded', 'released');

  v_best_objective := coalesce(public.best_objective_percentage(p_course_id, p_user_id), 0);

  v_result := jsonb_build_object(
    'progress_pct', v_pct,
    'required_lessons_done', v_done,
    'required_lessons_total', v_total,
    'objective_best', v_best_objective,
    'theory_best', coalesce(v_best_theory, 0)
  );

  if v_pct = 100
     and v_best_objective >= v_objective_pass
     and coalesce(v_best_theory, 0) >= v_theory_pass then
    v_result := v_result || jsonb_build_object('certificate_eligible', true);
    perform public.issue_certificate(p_user_id, p_course_id, false);
  end if;

  return v_result;
end;
$$;

create or replace function public.certificate_eligible(p_user_id uuid, p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_done int;
  v_objective numeric;
  v_theory numeric;
  v_objective_pass int;
  v_theory_pass int;
begin
  select count(*), count(*) filter (
    where exists (
      select 1 from public.lesson_progress lp
      where lp.lesson_id = l.id and lp.user_id = p_user_id and lp.status = 'completed'
    )
  )
  into v_total, v_done
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where m.course_id = p_course_id and l.is_required and l.status = 'published';

  v_objective := coalesce(public.best_objective_percentage(p_course_id, p_user_id), 0);

  select coalesce(max(ts.total_score), 0) into v_theory
  from public.theory_submissions ts
  where ts.user_id = p_user_id
    and ts.assessment_id in (
      select id from public.assessments where course_id = p_course_id and type = 'theory'
    )
    and ts.status in ('graded', 'released');

  v_objective_pass := public.get_setting_int('objective_pass_mark', 50);
  v_theory_pass := public.get_setting_int('theory_pass_mark', 50);

  return jsonb_build_object(
    'eligible', v_total = v_done and v_total > 0 and v_objective >= v_objective_pass and coalesce(v_theory, 0) >= v_theory_pass,
    'lessons', jsonb_build_object('done', v_done, 'total', v_total),
    'objective', jsonb_build_object('best', v_objective, 'pass_mark', v_objective_pass),
    'theory', jsonb_build_object('best', coalesce(v_theory, 0), 'pass_mark', v_theory_pass)
  );
end;
$$;

create or replace function public.issue_certificate(
  p_user_id uuid,
  p_course_id uuid,
  p_force boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eligibility jsonb;
  v_id uuid;
  v_number text;
begin
  if not p_force and not public.is_course_staff(p_course_id) and p_user_id <> auth.uid() then
    raise exception 'Not authorised to issue certificates';
  end if;

  if p_force and not public.is_admin() then
    raise exception 'Only administrators can force certificate issuance';
  end if;

  select id into v_id
  from public.certificates
  where user_id = p_user_id and course_id = p_course_id and status = 'issued';

  if v_id is not null then
    return v_id;
  end if;

  v_eligibility := public.certificate_eligible(p_user_id, p_course_id);

  if not (v_eligibility ->> 'eligible')::boolean and not p_force then
    raise exception 'Completion criteria are not met: %', v_eligibility;
  end if;

  v_number := 'LIS815-' || to_char(now(), 'YYYY') || '-' ||
    upper(substring(md5(p_user_id::text || p_course_id::text || now()::text) for 8));

  insert into public.certificates (user_id, course_id, certificate_number, eligibility_snapshot, issued_by)
  values (p_user_id, p_course_id, v_number, v_eligibility, auth.uid())
  returning id into v_id;

  perform public.notify(
    p_user_id,
    'certificate_issued',
    'Certificate of completion issued',
    'Your LIS 815 certificate is ready to download.',
    '/dashboard/certificate'
  );

  perform public.log_audit('certificate.issued', 'certificates', v_number, null, v_eligibility);

  return v_id;
end;
$$;

-- ============ Enrolment ============

create or replace function public.enroll_self(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  c record;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into c from public.courses where id = p_course_id and status = 'published' and deleted_at is null;
  if not found then
    raise exception 'Course not available';
  end if;
  if not c.enrolment_open then
    raise exception 'Enrolment is closed';
  end if;

  insert into public.course_enrollments (course_id, user_id)
  values (p_course_id, v_user_id)
  on conflict (course_id, user_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.course_enrollments where course_id = p_course_id and user_id = v_user_id;
  end if;

  return v_id;
end;
$$;

-- ============ Question delivery (students never read questions/options tables directly) ============

create or replace function public.get_attempt_snapshot(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.user_id <> v_user_id and not public.is_course_staff(public.course_of_assessment(att.assessment_id)) then
    raise exception 'Not authorised to view this attempt';
  end if;

  select * into a from public.assessments where id = att.assessment_id;

  return jsonb_build_object(
    'attempt_id', att.id,
    'assessment_id', att.assessment_id,
    'status', att.status,
    'attempt_no', att.attempt_no,
    'started_at', att.started_at,
    'expires_at', att.expires_at,
    'duration_minutes', a.duration_minutes,
    'randomize_options', a.randomize_options,
    'question_order', att.question_order,
    'questions', (
      select coalesce(jsonb_agg(s.q_json order by s.ord), '[]'::jsonb)
      from (
        select
          ids.ord,
          jsonb_build_object(
            'id', q.id,
            'stem_md', q.stem_md,
            'points', q.points,
            'type', q.type,
            'options', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text)
                  order by o.position, o.label
                ),
                '[]'::jsonb
              )
              from public.question_options o
              where o.question_id = q.id
            )
          ) as q_json
        from jsonb_array_elements_text(att.question_order) with ordinality as ids(id, ord)
        join public.questions q on q.id = ids.id::uuid
      ) s
    )
  );
end;
$$;

create or replace function public.get_attempt_results(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
  v_staff boolean;
  v_allow_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  v_staff := public.is_course_staff(public.course_of_assessment(att.assessment_id));

  if att.user_id <> v_user_id and not v_staff then
    raise exception 'Not authorised to view this attempt';
  end if;

  if att.status <> 'marked' and not v_staff then
    raise exception 'Results are not available yet';
  end if;

  select * into a from public.assessments where id = att.assessment_id;
  v_allow_correct := coalesce(a.show_correct_answers, true) or v_staff;

  return jsonb_build_object(
    'attempt_id', att.id,
    'status', att.status,
    'score', att.score,
    'total', att.total,
    'percentage', att.percentage,
    'passed', att.passed,
    'pass_mark', a.pass_mark,
    'show_correct_answers', v_allow_correct,
    'questions', (
      select coalesce(jsonb_agg(s.q_json order by s.ord), '[]'::jsonb)
      from (
        select
          ids.ord,
          jsonb_build_object(
            'id', q.id,
            'stem_md', q.stem_md,
            'points', q.points,
            'selected_option_id', aa.selected_option_id,
            'is_correct', aa.is_correct,
            'correct_option_id', case when v_allow_correct then co.id else null end,
            'correct_option_label', case when v_allow_correct then co.label else null end,
            'explanation_md', case when v_allow_correct then q.explanation_md else null end,
            'options', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text)
                  order by o.position, o.label
                ),
                '[]'::jsonb
              )
              from public.question_options o
              where o.question_id = q.id
            )
          ) as q_json
        from jsonb_array_elements_text(att.question_order) with ordinality as ids(id, ord)
        join public.questions q on q.id = ids.id::uuid
        left join public.attempt_answers aa
          on aa.attempt_id = att.id and aa.question_id = q.id
        left join public.question_options co
          on co.question_id = q.id and co.is_correct
      ) s
    )
  );
end;
$$;

create or replace function public.get_theory_questions(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into a from public.assessments where id = p_assessment_id;
  if not found then
    raise exception 'Assessment not found';
  end if;

  if a.type <> 'theory' then
    raise exception 'Assessment is not a theory examination';
  end if;

  if a.status <> 'published' then
    if not public.is_course_staff(a.course_id) then
      raise exception 'Examination is not published';
    end if;
  elsif not public.is_enrolled(a.course_id) and not public.is_course_staff(a.course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  return jsonb_build_object(
    'assessment_id', a.id,
    'title', a.title,
    'duration_minutes', a.duration_minutes,
    'available_from', a.available_from,
    'available_until', a.available_until,
    'questions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'position', q.position,
            'stem_md', q.stem_md,
            'points', q.points
          )
          order by q.position
        ),
        '[]'::jsonb
      )
      from public.questions q
      where q.assessment_id = p_assessment_id
        and q.status = 'published'
    )
  );
end;
$$;


-- =========================================================================
-- MIGRATION: 0003_rls.sql
-- =========================================================================

-- LIS 815 LMS - 0003_rls.sql
-- Row Level Security: students only see their own data and course content they may
-- access; answers, model solutions and grades never reach the client before release.

-- ============ Definer helpers used inside policies (bypass RLS, avoid recursion) ============

create or replace function public.course_of_lesson(p_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.course_id
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  join public.modules m on m.id = c.module_id
  where l.id = p_lesson_id
$$;

create or replace function public.course_of_chapter(p_chapter_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.course_id
  from public.chapters c
  join public.modules m on m.id = c.module_id
  where c.id = p_chapter_id
$$;

create or replace function public.course_of_assessment(p_assessment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select course_id from public.assessments where id = p_assessment_id
$$;

create or replace function public.course_of_question(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select course_id from public.assessments where id = q.assessment_id),
    (select course_id from public.question_banks where id = q.bank_id),
    (select m.course_id from public.modules m where m.id = q.module_id),
    (select m.course_id from public.chapters c join public.modules m on m.id = c.module_id where c.id = q.chapter_id)
  )
  from public.questions q
  where q.id = p_question_id
$$;

create or replace function public.course_of_submission(p_submission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.course_id
  from public.theory_submissions t
  join public.assessments s on s.id = t.assessment_id
  where t.id = p_submission_id
$$;

-- ============ Enable RLS on every public table ============

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end;
$$;

-- ============ Identity ============

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_superadmin());

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (true);

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated
  using (true);

drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists course_staff_select on public.course_staff;
create policy course_staff_select on public.course_staff
  for select to authenticated
  using (public.is_course_staff(course_id));

drop policy if exists course_staff_write on public.course_staff;
create policy course_staff_write on public.course_staff
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============ Course structure ============

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select to authenticated
  using (
    (deleted_at is null and status = 'published')
    or public.is_course_staff(id)
  );

drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and c.status = 'published'
        and c.deleted_at is null
    )
    or public.is_course_staff(course_id)
  );

drop policy if exists modules_write on public.modules;
create policy modules_write on public.modules
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists chapters_select on public.chapters;
create policy chapters_select on public.chapters
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = chapters.module_id
        and c.status = 'published'
        and c.deleted_at is null
    )
    or public.is_course_staff(public.course_of_chapter(chapters.id))
  );

drop policy if exists chapters_write on public.chapters;
create policy chapters_write on public.chapters
  for all to authenticated
  using (public.is_course_staff(public.course_of_chapter(chapters.id)))
  with check (public.is_course_staff(
    (select m.course_id from public.modules m where m.id = chapters.module_id)
  ));

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (
    (
      status = 'published'
      and public.is_enrolled(public.course_of_lesson(lessons.id))
      and exists (
        select 1 from public.courses c
        where c.id = public.course_of_lesson(lessons.id)
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
    or public.is_course_staff(public.course_of_lesson(lessons.id))
  );

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all to authenticated
  using (public.is_course_staff(public.course_of_lesson(lessons.id)))
  with check (public.is_course_staff(
    (select m.course_id
     from public.chapters c
     join public.modules m on m.id = c.module_id
     where c.id = lessons.chapter_id)
  ));

drop policy if exists lesson_sections_select on public.lesson_sections;
create policy lesson_sections_select on public.lesson_sections
  for select to authenticated
  using (public.can_access_lesson(lesson_sections.lesson_id));

drop policy if exists lesson_sections_write on public.lesson_sections;
create policy lesson_sections_write on public.lesson_sections
  for all to authenticated
  using (public.is_course_staff(public.course_of_lesson(lesson_sections.lesson_id)))
  with check (public.is_course_staff(public.course_of_lesson(lesson_sections.lesson_id)));

drop policy if exists lesson_prerequisites_select on public.lesson_prerequisites;
create policy lesson_prerequisites_select on public.lesson_prerequisites
  for select to authenticated
  using (true);

drop policy if exists lesson_prerequisites_write on public.lesson_prerequisites;
create policy lesson_prerequisites_write on public.lesson_prerequisites
  for all to authenticated
  using (public.is_course_staff(public.course_of_lesson(lesson_prerequisites.lesson_id)))
  with check (
    public.is_course_staff(public.course_of_lesson(lesson_prerequisites.lesson_id))
    and public.is_course_staff(public.course_of_lesson(lesson_prerequisites.prerequisite_lesson_id))
  );

-- ============ Learner state ============

drop policy if exists reading_events_select on public.reading_events;
create policy reading_events_select on public.reading_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_lesson(lesson_id))
  );

drop policy if exists course_enrollments_select on public.course_enrollments;
create policy course_enrollments_select on public.course_enrollments
  for select to authenticated
  using (user_id = auth.uid() or public.is_course_staff(course_id));

drop policy if exists course_enrollments_update on public.course_enrollments;
create policy course_enrollments_update on public.course_enrollments
  for update to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists course_enrollments_delete on public.course_enrollments;
create policy course_enrollments_delete on public.course_enrollments
  for delete to authenticated
  using (public.is_course_staff(course_id));

drop policy if exists lesson_progress_select on public.lesson_progress;
create policy lesson_progress_select on public.lesson_progress
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_lesson(lesson_id))
  );

-- Students hold no insert/update/delete policy on lesson_progress:
-- writes go through mark_lesson_complete() and record_reading_event() only.

-- ============ Assessments ============

drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = assessments.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists assessments_write on public.assessments;
create policy assessments_write on public.assessments
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists question_banks_select on public.question_banks;
create policy question_banks_select on public.question_banks
  for select to authenticated
  using (public.is_course_staff(course_id));

drop policy if exists question_banks_write on public.question_banks;
create policy question_banks_write on public.question_banks
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select to authenticated
  using (public.is_course_staff(public.course_of_question(questions.id)));

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions
  for all to authenticated
  using (public.is_course_staff(public.course_of_question(questions.id)))
  with check (public.is_course_staff(coalesce(
    (select course_id from public.assessments where id = questions.assessment_id),
    (select course_id from public.question_banks where id = questions.bank_id),
    (select m.course_id from public.modules m where m.id = questions.module_id),
    (select m.course_id
     from public.chapters c
     join public.modules m on m.id = c.module_id
     where c.id = questions.chapter_id)
  )));

drop policy if exists question_options_select on public.question_options;
create policy question_options_select on public.question_options
  for select to authenticated
  using (public.is_course_staff(public.course_of_question(question_options.question_id)));

drop policy if exists question_options_write on public.question_options;
create policy question_options_write on public.question_options
  for all to authenticated
  using (public.is_course_staff(public.course_of_question(question_options.question_id)))
  with check (public.is_course_staff(public.course_of_question(question_options.question_id)));

drop policy if exists assessment_attempts_select on public.assessment_attempts;
create policy assessment_attempts_select on public.assessment_attempts
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_assessment(assessment_id))
  );

drop policy if exists attempt_answers_select on public.attempt_answers;
create policy attempt_answers_select on public.attempt_answers
  for select to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_answers.attempt_id
      and a.user_id = auth.uid()
  ));

drop policy if exists attempt_answers_insert on public.attempt_answers;
create policy attempt_answers_insert on public.attempt_answers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_answers.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'in_progress'
    )
    and public.question_in_attempt(attempt_answers.attempt_id, attempt_answers.question_id)
    and (
      attempt_answers.selected_option_id is null
      or public.option_belongs_to_question(
           attempt_answers.selected_option_id,
           attempt_answers.question_id
         )
    )
  );

drop policy if exists attempt_answers_update on public.attempt_answers;
create policy attempt_answers_update on public.attempt_answers
  for update to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_answers.attempt_id
      and a.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_answers.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'in_progress'
    )
    and public.question_in_attempt(attempt_answers.attempt_id, attempt_answers.question_id)
    and (
      attempt_answers.selected_option_id is null
      or public.option_belongs_to_question(
           attempt_answers.selected_option_id,
           attempt_answers.question_id
         )
    )
  );

drop policy if exists attempt_answers_delete on public.attempt_answers;
create policy attempt_answers_delete on public.attempt_answers
  for delete to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_answers.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'in_progress'
  ));

-- ============ Theory examination ============

drop policy if exists theory_submissions_select on public.theory_submissions;
create policy theory_submissions_select on public.theory_submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_submission(theory_submissions.id))
  );

drop policy if exists theory_answers_select on public.theory_answers;
create policy theory_answers_select on public.theory_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.theory_submissions s
      where s.id = theory_answers.submission_id
        and s.user_id = auth.uid()
    )
    or public.is_course_staff(public.course_of_submission(theory_answers.submission_id))
  );

drop policy if exists theory_answers_update on public.theory_answers;
create policy theory_answers_update on public.theory_answers
  for update to authenticated
  using (exists (
    select 1 from public.theory_submissions s
    where s.id = theory_answers.submission_id
      and s.user_id = auth.uid()
      and s.status = 'draft'
  ))
  with check (exists (
    select 1 from public.theory_submissions s
    where s.id = theory_answers.submission_id
      and s.user_id = auth.uid()
      and s.status = 'draft'
  ));

drop policy if exists theory_grades_select on public.theory_grades;
create policy theory_grades_select on public.theory_grades
  for select to authenticated
  using (
    public.is_course_staff(public.course_of_submission(
      (select submission_id from public.theory_answers where id = theory_grades.theory_answer_id)
    ))
    or exists (
      select 1
      from public.theory_answers ta
      join public.theory_submissions s on s.id = ta.submission_id
      where ta.id = theory_grades.theory_answer_id
        and s.user_id = auth.uid()
        and s.status = 'released'
    )
  );

drop policy if exists theory_grades_write on public.theory_grades;
create policy theory_grades_write on public.theory_grades
  for all to authenticated
  using (public.has_permission('assessment.grade') or public.is_admin())
  with check (public.has_permission('assessment.grade') or public.is_admin());

-- ============ Content support ============

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and visibility = 'students'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = resources.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists resources_write on public.resources;
create policy resources_write on public.resources
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists glossary_terms_select on public.glossary_terms;
create policy glossary_terms_select on public.glossary_terms
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = glossary_terms.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists glossary_terms_write on public.glossary_terms;
create policy glossary_terms_write on public.glossary_terms
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists bookmarks_select on public.bookmarks;
create policy bookmarks_select on public.bookmarks
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists bookmarks_insert on public.bookmarks;
create policy bookmarks_insert on public.bookmarks
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists bookmarks_delete on public.bookmarks;
create policy bookmarks_delete on public.bookmarks
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and publish_at <= now()
      and (audience = 'all' or public.is_enrolled(course_id))
      and exists (
        select 1 from public.courses c
        where c.id = announcements.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ============ Practical activities ============

drop policy if exists practical_activities_select on public.practical_activities;
create policy practical_activities_select on public.practical_activities
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = practical_activities.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists practical_activities_write on public.practical_activities;
create policy practical_activities_write on public.practical_activities
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists practical_submissions_select on public.practical_submissions;
create policy practical_submissions_select on public.practical_submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff((select course_id from public.practical_activities where id = practical_submissions.activity_id))
  );

drop policy if exists practical_submissions_insert on public.practical_submissions;
create policy practical_submissions_insert on public.practical_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.practical_activities pa
      where pa.id = activity_id
        and pa.status = 'published'
        and public.is_enrolled(pa.course_id)
    )
  );

drop policy if exists practical_submissions_update on public.practical_submissions;
create policy practical_submissions_update on public.practical_submissions
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff((select course_id from public.practical_activities where id = practical_submissions.activity_id))
  )
  with check (
    user_id = auth.uid()
    or public.is_course_staff((select course_id from public.practical_activities where id = practical_submissions.activity_id))
  );

-- ============ Outcomes and platform ============

drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select to authenticated
  using (user_id = auth.uid() or public.is_course_staff(course_id));

drop policy if exists certificates_update on public.certificates;
create policy certificates_update on public.certificates
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (not is_secret or public.is_admin());

drop policy if exists system_settings_write on public.system_settings;
create policy system_settings_write on public.system_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists search_index_select on public.search_index;
create policy search_index_select on public.search_index
  for select to authenticated
  using (public.is_admin());

-- rate_limits: no policies; service role only (BYPASSRLS).

-- ============ Column guards for tables students may write ============

create or replace function public.protect_attempt_answers()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.is_correct is not null then
    raise exception 'is_correct is calculated by the server';
  end if;
  if tg_op = 'UPDATE' and new.is_correct is distinct from old.is_correct then
    raise exception 'is_correct is calculated by the server';
  end if;
  if tg_op = 'UPDATE' and new.attempt_id is distinct from old.attempt_id then
    raise exception 'attempt_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_attempt_answers on public.attempt_answers;
create trigger protect_attempt_answers
  before insert or update on public.attempt_answers
  for each row execute function public.protect_attempt_answers();

create or replace function public.protect_theory_answers()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
    new.submission_id is distinct from old.submission_id
    or new.question_id is distinct from old.question_id
    or new.status is distinct from old.status
  ) then
    raise exception 'This field is managed by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_theory_answers on public.theory_answers;
create trigger protect_theory_answers
  before insert or update on public.theory_answers
  for each row execute function public.protect_theory_answers();

create or replace function public.protect_practical_grading()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' and (
    new.score is not null
    or new.feedback is not null
    or new.graded_by is not null
    or new.graded_at is not null
  ) then
    raise exception 'Grading fields are managed by the server';
  end if;
  if tg_op = 'UPDATE' and (
    new.score is distinct from old.score
    or new.feedback is distinct from old.feedback
    or new.graded_by is distinct from old.graded_by
    or new.graded_at is distinct from old.graded_at
    or (new.status = 'graded' and old.status <> 'graded')
    or new.activity_id is distinct from old.activity_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Grading fields are managed by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_practical_grading on public.practical_submissions;
create trigger protect_practical_grading
  before insert or update on public.practical_submissions
  for each row execute function public.protect_practical_grading();


-- =========================================================================
-- MIGRATION: 0004_seed_settings.sql
-- =========================================================================

-- LIS 815 LMS - 0004_seed_settings.sql
-- Idempotent seed: roles, permissions, and the platform settings table.
-- Values are documented defaults; the real values live in system_settings (admin-editable).

-- ============ Roles ============

insert into public.roles (code, name, description)
values
  ('superadmin', 'Super Administrator', 'Full control including role management'),
  ('admin', 'Administrator', 'Course, content, grading and platform administration'),
  ('student', 'Student', 'Enrolled learner')
on conflict (code) do nothing;

-- ============ Permissions ============

insert into public.permissions (code, description)
values
  ('content.publish', 'Create, edit and publish course content'),
  ('content.manage', 'Manage glossary, resources and practical activities'),
  ('assessment.grade', 'Grade theory examinations and practical submissions'),
  ('assessment.manage', 'Create and configure assessments and question banks'),
  ('user.manage', 'Manage user accounts and enrolments'),
  ('settings.manage', 'Edit platform settings'),
  ('certificate.issue', 'Issue and revoke certificates'),
  ('announcement.post', 'Post course announcements'),
  ('audit.view', 'View audit logs')
on conflict (code) do nothing;

-- ============ Role -> permission grants ============

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where r.code in ('superadmin', 'admin')
on conflict do nothing;

-- Students hold no permissions; their access is enforced by RLS.

-- ============ Platform settings ============
-- jsonb values. Marked LMS default where the source PDFs do not specify one.

insert into public.system_settings (key, value, description, is_secret)
values
  ('course_code', '"LIS 815"', 'Official course code shown on certificates', false),
  ('course_title', '"Indexing and Abstracting"', 'Official course title', false),
  ('institution', '""', 'Institution name printed on certificates', false),
  ('theory_unlock_score', '70', 'Minimum objective-assessment percentage to unlock the theory exam (LMS default, not from source)', false),
  ('theory_pass_mark', '50', 'Theory pass mark out of 100 (LMS default, not from source)', false),
  ('objective_pass_mark', '50', 'Objective pass mark percentage (LMS default, not from source)', false),
  ('knowledge_check_pass_mark', '70', 'Default knowledge-check pass mark for lesson gating', false),
  ('reading_required_pct', '90', 'Percentage of a lesson that must be read before completion (LMS default, not from source)', false),
  ('retake_policy', '"unlimited"', 'Retake policy for assessments: unlimited or none. Best attempt counts (LMS default)', false),
  ('auto_issue_certificates', 'true', 'Issue certificates automatically when all criteria are met', false),
  ('certificate_prefix', '"LIS815"', 'Prefix used in certificate numbers', false),
  ('support_email', '""', 'Contact address shown on the Help page', false),
  ('maintenance_mode', 'false', 'When true, students see a maintenance message', false),
  ('analytics_enabled', 'false', 'Reserved: no third-party analytics are bundled', false)
on conflict (key) do nothing;

-- Secret example (kept empty): values marked is_secret are never returned by get_setting()
-- to non-admin users and are hidden from the settings table by RLS.
insert into public.system_settings (key, value, description, is_secret)
values ('email_api_key', '""', 'Reserved for future email delivery', true)
on conflict (key) do nothing;


-- =========================================================================
-- MIGRATION: 0005_search.sql
-- =========================================================================

-- LIS 815 LMS - 0005_search.sql
-- Full-text search over lessons, glossary, resources and announcements.
-- Students only ever receive rows they could open anyway (access checks run server-side).

create or replace function public.index_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lesson record;
  v_body text;
begin
  select
    l.id,
    l.title,
    m.course_id,
    (l.status = 'published'
     and c.status = 'published'
     and co.status = 'published'
     and co.deleted_at is null) as visible
  into v_lesson
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  join public.modules m on m.id = c.module_id
  join public.courses co on co.id = m.course_id
  where l.id = p_lesson_id;

  if not found then
    delete from public.search_index where entity_type = 'lesson' and entity_id = p_lesson_id;
    return;
  end if;

  if not v_lesson.visible then
    delete from public.search_index where entity_type = 'lesson' and entity_id = p_lesson_id;
    return;
  end if;

  select coalesce(string_agg(
    coalesce(s.title, '') || E'\n' || s.content_md, E'\n' order by s.position
  ), '')
  into v_body
  from public.lesson_sections s
  where s.lesson_id = p_lesson_id;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'lesson', p_lesson_id, v_lesson.course_id, v_lesson.title, v_body,
    to_tsvector('english', v_lesson.title),
    to_tsvector('english', v_body)
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.index_glossary(p_term_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select g.id, g.term, g.definition, g.course_id, g.module_id, co.status as course_status
  into v
  from public.glossary_terms g
  join public.courses co on co.id = g.course_id
  where g.id = p_term_id;

  if not found or v.course_status <> 'published' then
    delete from public.search_index where entity_type = 'glossary' and entity_id = p_term_id;
    return;
  end if;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'glossary', p_term_id, v.course_id, v.term, v.definition,
    to_tsvector('english', v.term),
    to_tsvector('english', v.definition)
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.index_resource(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select r.id, r.title, r.description, r.course_id, r.status, r.visibility, co.status as course_status
  into v
  from public.resources r
  join public.courses co on co.id = r.course_id
  where r.id = p_resource_id;

  if not found or v.status <> 'published' or v.visibility <> 'students' or v.course_status <> 'published' then
    delete from public.search_index where entity_type = 'resource' and entity_id = p_resource_id;
    return;
  end if;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'resource', p_resource_id, v.course_id, v.title, coalesce(v.description, ''),
    to_tsvector('english', v.title),
    to_tsvector('english', coalesce(v.description, ''))
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.index_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select a.id, a.title, a.body_md, a.course_id, a.status, a.publish_at, co.status as course_status
  into v
  from public.announcements a
  join public.courses co on co.id = a.course_id
  where a.id = p_announcement_id;

  if not found or v.status <> 'published' or v.publish_at > now() or v.course_status <> 'published' then
    delete from public.search_index where entity_type = 'announcement' and entity_id = p_announcement_id;
    return;
  end if;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'announcement', p_announcement_id, v.course_id, v.title, v.body_md,
    to_tsvector('english', v.title),
    to_tsvector('english', v.body_md)
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.rebuild_search_index()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in select id from public.lessons loop
    perform public.index_lesson(r.id);
  end loop;
  for r in select id from public.glossary_terms loop
    perform public.index_glossary(r.id);
  end loop;
  for r in select id from public.resources loop
    perform public.index_resource(r.id);
  end loop;
  for r in select id from public.announcements loop
    perform public.index_announcement(r.id);
  end loop;
end;
$$;

create or replace function public.search_content(p_query text, p_limit int default 20)
returns table (
  entity_type text,
  entity_id uuid,
  course_id uuid,
  title text,
  snippet text,
  rank real
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ts tsquery;
begin
  if p_query is null or btrim(p_query) = '' then
    return;
  end if;

  v_ts := plainto_tsquery('english', p_query);
  if v_ts is null then
    return;
  end if;

  return query
  select
    s.entity_type,
    s.entity_id,
    s.course_id,
    s.title,
    left(s.body, 240) as snippet,
    ts_rank(setweight(s.title_tsv, 'A') || setweight(s.body_tsv, 'B'), v_ts) as rank
  from public.search_index s
  where (s.title_tsv @@ v_ts or s.body_tsv @@ v_ts)
    and (
      public.is_admin()
      or public.is_course_staff(s.course_id)
      or (
        s.course_id in (
          select ce.course_id from public.course_enrollments ce
          where ce.user_id = auth.uid() and ce.status in ('active', 'completed')
        )
        and (
          (s.entity_type = 'lesson' and public.can_access_lesson(s.entity_id))
          or s.entity_type in ('glossary', 'resource', 'announcement')
        )
      )
    )
  order by rank desc, s.title
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- ============ Keep the index in sync ============

create or replace function public.trg_lesson_lesson_sections_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.index_lesson(coalesce(new.lesson_id, old.lesson_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists lesson_sections_reindex on public.lesson_sections;
create trigger lesson_sections_reindex
  after insert or update or delete on public.lesson_sections
  for each row execute function public.trg_lesson_lesson_sections_touch();

create or replace function public.trg_lesson_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.index_lesson(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists lessons_reindex on public.lessons;
create trigger lessons_reindex
  after insert or update or delete on public.lessons
  for each row execute function public.trg_lesson_touch();

create or replace function public.trg_glossary_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'glossary' and entity_id = old.id;
    return old;
  end if;
  perform public.index_glossary(new.id);
  return new;
end;
$$;

drop trigger if exists glossary_terms_reindex on public.glossary_terms;
create trigger glossary_terms_reindex
  after insert or update or delete on public.glossary_terms
  for each row execute function public.trg_glossary_touch();

create or replace function public.trg_resource_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'resource' and entity_id = old.id;
    return old;
  end if;
  perform public.index_resource(new.id);
  return new;
end;
$$;

drop trigger if exists resources_reindex on public.resources;
create trigger resources_reindex
  after insert or update or delete on public.resources
  for each row execute function public.trg_resource_touch();

create or replace function public.trg_announcement_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'announcement' and entity_id = old.id;
    return old;
  end if;
  perform public.index_announcement(new.id);
  return new;
end;
$$;

drop trigger if exists announcements_reindex on public.announcements;
create trigger announcements_reindex
  after insert or update or delete on public.announcements
  for each row execute function public.trg_announcement_touch();

-- Initial build (safe on an empty database).
select public.rebuild_search_index();


-- =========================================================================
-- MIGRATION: 0006_auth.sql
-- =========================================================================

-- LIS 815 LMS - 0006_auth.sql
-- One-time superadmin claim, role-change auditing, avatar storage.

create or replace function public.claim_first_superadmin()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_admin_role_id uuid;
  v_exists boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(918273);

  select id into v_admin_role_id from public.roles where code = 'superadmin';

  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.code = 'superadmin'
  ) into v_exists;

  if v_exists then
    return jsonb_build_object(
      'claimed', false,
      'message', 'A superadmin already exists. Ask them to grant your account the admin role from the Users page.'
    );
  end if;

  if v_admin_role_id is null then
    insert into public.roles (code, name, description)
    values ('superadmin', 'Super Administrator', 'Full control including role management')
    returning id into v_admin_role_id;
  end if;

  insert into public.user_roles (user_id, role_id, granted_by)
  values (v_user_id, v_admin_role_id, v_user_id)
  on conflict do nothing;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (v_user_id, 'role.superadmin_claimed', 'user_roles', v_user_id::text,
          jsonb_build_object('role', 'superadmin'));

  update public.profiles
  set updated_at = now()
  where id = v_user_id;

  return jsonb_build_object(
    'claimed', true,
    'message', 'You are now the superadmin. Sign out and back in to load your new role.'
  );
end;
$$;

create or replace function public.superadmin_exists()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.code = 'superadmin'
  )
$$;

create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  select code into v_code from public.roles where id = coalesce(new.role_id, old.role_id);

  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
    values (auth.uid(), 'role.granted', 'user_roles',
            (coalesce(new.user_id::text, '') || ':' || coalesce(v_code, '')),
            jsonb_build_object('user_id', new.user_id, 'role', v_code, 'granted_by', new.granted_by));
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before)
  values (auth.uid(), 'role.revoked', 'user_roles',
          (coalesce(old.user_id::text, '') || ':' || coalesce(v_code, '')),
          jsonb_build_object('user_id', old.user_id, 'role', v_code));
  return old;
end;
$$;

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function public.audit_role_change();

-- Avatar storage (only when running on Supabase, which has the storage schema).
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

  execute 'drop policy if exists "avatars_insert_own" on storage.objects';
  execute $p$
    create policy "avatars_insert_own" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;

  execute 'drop policy if exists "avatars_update_own" on storage.objects';
  execute $p$
    create policy "avatars_update_own" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;

  execute 'drop policy if exists "avatars_delete_own" on storage.objects';
  execute $p$
    create policy "avatars_delete_own" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
end;
$$;


-- =========================================================================
-- MIGRATION: 0007_assessment_engine.sql
-- =========================================================================

-- LIS 815 LMS - 0007_assessment_engine.sql
-- Phase 6: the writes and reads the assessment engine needs.
--   * mark_attempt_internal()  - one place that marks an attempt from saved answers
--   * save_answer()            - expiry-checked answer upsert (is_correct stays server-side)
--   * assessment_centre()      - one call that powers the assessment centre page
--   * theory_eligibility()     - the 70% gate, with a plain-English reason
--   * submit_objective_attempt - now marks what was saved when time runs out
--   * get_attempt_results      - a timed-out attempt still returns its score
-- Idempotent: safe to re-run.

-- ============ User-scoped copies of the two access helpers ============
-- is_enrolled() and is_course_staff() answer for the *caller*. Staff need the same
-- answers for the learner in front of them, and theory_eligibility(p_course_id,
-- p_user_id) promises exactly that, so these take the user explicitly.

create or replace function public.is_enrolled_for(p_course_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.course_enrollments ce
    where ce.course_id = p_course_id
      and ce.user_id = p_user_id
      and ce.status in ('active', 'completed')
  )
$$;

create or replace function public.is_course_staff_for(p_course_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and r.code in ('admin', 'superadmin')
  )
  or exists (
    select 1 from public.course_staff cs
    where cs.course_id = p_course_id
      and cs.user_id = p_user_id
  )
$$;

-- ============ Marking ============

-- Marks an attempt from the answers already saved. p_final_status is 'marked' for a
-- normal submission and 'expired' when the clock ran out, so the learner can still see
-- the score for the answers the server accepted.
create or replace function public.mark_attempt_internal(p_attempt_id uuid, p_final_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  att record;
  a record;
  v_score numeric := 0;
  v_total numeric := 0;
  v_pct numeric := 0;
begin
  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.status not in ('in_progress', 'submitted', 'expired') then
    return null; -- already marked; marking twice must not change the score
  end if;

  select * into a from public.assessments where id = att.assessment_id;

  update public.attempt_answers aa
  set is_correct = coalesce(qo.is_correct, false)
  from public.question_options qo
  where qo.id = aa.selected_option_id
    and aa.attempt_id = p_attempt_id;

  update public.attempt_answers
  set is_correct = false
  where attempt_id = p_attempt_id
    and selected_option_id is null;

  select
    coalesce(sum(q.points), 0),
    coalesce(sum(case when aa.is_correct then q.points else 0 end), 0)
  into v_total, v_score
  from jsonb_array_elements_text(att.question_order) as ids(id)
  join public.questions q on q.id = ids.id::uuid
  left join public.attempt_answers aa on aa.attempt_id = p_attempt_id and aa.question_id = q.id;

  if v_total > 0 then
    v_pct := round((v_score / v_total) * 100, 2);
  end if;

  update public.assessment_attempts
  set status = p_final_status,
      submitted_at = coalesce(submitted_at, now()),
      marked_at = now(),
      score = v_score,
      total = v_total,
      percentage = v_pct,
      passed = v_pct >= a.pass_mark
  where id = p_attempt_id;

  if p_final_status = 'marked' then
    perform public.notify(
      att.user_id,
      'objective_marked',
      a.title || ' result',
      case when v_pct >= a.pass_mark
        then 'You scored ' || v_pct || '%. Passed.'
        else 'You scored ' || v_pct || '%. The pass mark is ' || a.pass_mark || '%.'
      end,
      '/dashboard/assessments/' || a.id
    );
  end if;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'score', v_score,
    'total', v_total,
    'percentage', v_pct,
    'passed', v_pct >= a.pass_mark,
    'pass_mark', a.pass_mark,
    'expired', p_final_status = 'expired'
  );
end;
$$;

-- ============ Saving one answer ============

-- The exam runner calls this on every change. It never touches is_correct.
-- Once the clock has run out it does NOT raise: an exception would roll back the
-- marking that has to survive, so it marks the attempt and returns expired = true for
-- the runner to act on. A closed (already marked) attempt is refused loudly, because
-- there is no work left for the server to do.
create or replace function public.save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  v_marked jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att
  from public.assessment_attempts
  where id = p_attempt_id and user_id = v_user_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.status not in ('in_progress', 'expired') then
    raise exception 'This attempt is closed';
  end if;

  if att.expires_at is not null and now() > att.expires_at then
    v_marked := public.mark_attempt_internal(p_attempt_id, 'expired');
    return v_marked || jsonb_build_object(
      'question_id', p_question_id,
      'saved', false,
      'status', 'expired',
      'reason', 'Time is up. Your saved answers have been marked.'
    );
  end if;

  if not public.question_in_attempt(p_attempt_id, p_question_id) then
    raise exception 'That question is not part of this attempt';
  end if;

  if p_selected_option_id is not null
     and not public.option_belongs_to_question(p_selected_option_id, p_question_id) then
    raise exception 'That option does not belong to this question';
  end if;

  insert into public.attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
  values (p_attempt_id, p_question_id, p_selected_option_id, now())
  on conflict (attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        answered_at = now(),
        updated_at = now()
    where public.attempt_answers.selected_option_id is distinct from excluded.selected_option_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'question_id', p_question_id,
    'selected_option_id', p_selected_option_id,
    'saved', true,
    'status', 'in_progress',
    'saved_at', now(),
    'expires_at', att.expires_at
  );
end;
$$;

-- ============ Assessment centre ============

-- Everything the centre page needs in one call: the published assessments, how many
-- questions each holds (students may not read the questions table), the learner's own
-- attempts, and the best score so far.
create or replace function public.assessment_centre(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_enrolled boolean;
  v_staff boolean;
  v_lessons_done int := 0;
  v_lessons_total int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_enrolled := public.is_enrolled_for(p_course_id, v_user_id);
  v_staff := public.is_course_staff_for(p_course_id, v_user_id);

  if not v_enrolled and not v_staff then
    raise exception 'Not enrolled in this course';
  end if;

  select
    count(*) filter (where l.is_required and l.status = 'published'),
    count(*) filter (where l.is_required and l.status = 'published' and lp.status = 'completed')
  into v_lessons_total, v_lessons_done
  from public.modules m
  join public.chapters c on c.module_id = m.id
  join public.lessons l on l.chapter_id = c.id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_user_id
  where m.course_id = p_course_id;

  return jsonb_build_object(
    'enrolled', v_enrolled,
    'required_lessons_total', v_lessons_total,
    'required_lessons_done', v_lessons_done,
    'assessments', (
      select coalesce(jsonb_agg(s.a_json order by s.ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by a.type, a.created_at) as ord,
          jsonb_build_object(
            'id', a.id,
            'type', a.type,
            'title', a.title,
            'description', a.description,
            'duration_minutes', a.duration_minutes,
            'max_attempts', a.max_attempts,
            'pass_mark', a.pass_mark,
            'randomize_questions', a.randomize_questions,
            'randomize_options', a.randomize_options,
            'show_correct_answers', a.show_correct_answers,
            'available_from', a.available_from,
            'available_until', a.available_until,
            'prerequisite', a.prerequisite,
            'settings', a.settings,
            'question_count', (
              select count(*)::int from public.questions q
              where q.assessment_id = a.id and q.status = 'published'
            ),
            'attempts', (
              select coalesce(jsonb_agg(t.t_json order by t.attempt_no), '[]'::jsonb)
              from (
                select
                  at.attempt_no,
                  jsonb_build_object(
                    'id', at.id,
                    'attempt_no', at.attempt_no,
                    'status', at.status,
                    'started_at', at.started_at,
                    'expires_at', at.expires_at,
                    'submitted_at', at.submitted_at,
                    'score', at.score,
                    'total', at.total,
                    'percentage', at.percentage,
                    'passed', at.passed,
                    'answered', (
                      select count(*)::int from public.attempt_answers aa
                      where aa.attempt_id = at.id
                    )
                  ) as t_json
                from public.assessment_attempts at
                where at.assessment_id = a.id and at.user_id = v_user_id
              ) t
            )
          ) as a_json
        from public.assessments a
        where a.course_id = p_course_id
          and a.status = 'published'
          and (a.available_from is null or a.available_from <= now() or v_staff)
      ) s
    )
  );
end;
$$;

-- ============ The 70% gate ============

-- Four states the theory section shows, each with a reason a learner can act on:
--   not_enrolled | not_attempted | below_threshold | eligible
-- Required-lesson gating is enforced earlier, by start_objective_attempt()'s own
-- 'all_lessons' prerequisite, so it is reported here for context but not gated on.
create or replace function public.theory_eligibility(p_course_id uuid, p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_threshold int;
  v_best numeric;
  v_lessons_done int := 0;
  v_lessons_total int := 0;
  v_attempts int := 0;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_threshold := coalesce(public.get_setting_int('theory_unlock_score', 70), 70);

  select
    count(*) filter (where l.is_required and l.status = 'published'),
    count(*) filter (where l.is_required and l.status = 'published' and lp.status = 'completed')
  into v_lessons_total, v_lessons_done
  from public.modules m
  join public.chapters c on c.module_id = m.id
  join public.lessons l on l.chapter_id = c.id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_user
  where m.course_id = p_course_id;

  select count(*) into v_attempts
  from public.assessment_attempts aa
  join public.assessments a on a.id = aa.assessment_id
  where a.course_id = p_course_id and a.type = 'objective' and aa.user_id = v_user;

  v_best := public.best_objective_percentage(p_course_id, v_user);

  return jsonb_build_object(
    'state', case
      when not public.is_enrolled_for(p_course_id, v_user)
           and not public.is_course_staff_for(p_course_id, v_user)
        then 'not_enrolled'
      when v_best >= v_threshold then 'eligible'
      when v_attempts = 0 then 'not_attempted'
      else 'below_threshold'
    end,
    'threshold', v_threshold,
    'best_percentage', v_best,
    'attempt_count', v_attempts,
    'required_lessons_total', v_lessons_total,
    'required_lessons_done', v_lessons_done,
    'reason', case
      when not public.is_enrolled_for(p_course_id, v_user)
           and not public.is_course_staff_for(p_course_id, v_user)
        then 'Enrol in the course to sit the theory examination.'
      when v_best >= v_threshold
        then 'You reached ' || v_threshold || ' percent on the objective assessment, so the theory examination is open.'
      when v_attempts = 0
        then 'Sit the objective assessment first. The theory examination opens at ' || v_threshold || ' percent.'
      else 'The theory examination opens at ' || v_threshold || ' percent on the objective assessment. Your best score is ' || round(v_best)::int || ' percent.'
    end
  );
end;
$$;

-- ============ Submission now scores a timed-out attempt ============

create or replace function public.submit_objective_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att
  from public.assessment_attempts
  where id = p_attempt_id and user_id = v_user_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.status <> 'in_progress' then
    -- Submitting twice must never produce a second score.
    if att.status in ('marked', 'expired') then
      return jsonb_build_object(
        'attempt_id', att.id,
        'score', att.score,
        'total', att.total,
        'percentage', att.percentage,
        'passed', att.passed,
        'already_submitted', true,
        'expired', att.status = 'expired'
      );
    end if;
    raise exception 'Attempt is already submitted';
  end if;

  if att.expires_at is not null and now() > att.expires_at then
    v_result := public.mark_attempt_internal(p_attempt_id, 'expired');
    v_result := v_result || jsonb_build_object('already_submitted', false);
    return v_result;
  end if;

  v_result := public.mark_attempt_internal(p_attempt_id, 'marked');
  return v_result || jsonb_build_object('already_submitted', false);
end;
$$;

-- ============ Results for a timed-out attempt ============

create or replace function public.get_attempt_results(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
  v_staff boolean;
  v_allow_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  v_staff := public.is_course_staff(public.course_of_assessment(att.assessment_id));

  if att.user_id <> v_user_id and not v_staff then
    raise exception 'Not authorised to view this attempt';
  end if;

  if att.status not in ('marked', 'expired') and not v_staff then
    raise exception 'Results are not available yet';
  end if;

  select * into a from public.assessments where id = att.assessment_id;
  v_allow_correct := coalesce(a.show_correct_answers, true) or v_staff;

  return jsonb_build_object(
    'attempt_id', att.id,
    'assessment_id', att.assessment_id,
    'assessment_title', a.title,
    'pass_mark', a.pass_mark,
    'status', att.status,
    'expired', att.status = 'expired',
    'attempt_no', att.attempt_no,
    'score', att.score,
    'total', att.total,
    'percentage', att.percentage,
    'passed', att.passed,
    'show_correct_answers', v_allow_correct,
    'questions', (
      select coalesce(jsonb_agg(s.q_json order by s.ord), '[]'::jsonb)
      from (
        select
          ids.ord,
          jsonb_build_object(
            'id', q.id,
            'stem_md', q.stem_md,
            'points', q.points,
            'selected_option_id', aa.selected_option_id,
            'is_correct', aa.is_correct,
            'correct_option_id', case when v_allow_correct then co.id else null end,
            'correct_option_label', case when v_allow_correct then co.label else null end,
            'explanation_md', case when v_allow_correct then q.explanation_md else null end,
            'chapter_id', q.chapter_id,
            'options', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text)
                  order by o.position, o.label
                ),
                '[]'::jsonb
              )
              from public.question_options o
              where o.question_id = q.id
            )
          ) as q_json
        from jsonb_array_elements_text(att.question_order) with ordinality as ids(id, ord)
        join public.questions q on q.id = ids.id::uuid
        left join public.attempt_answers aa
          on aa.attempt_id = att.id and aa.question_id = q.id
        left join public.question_options co
          on co.question_id = q.id and co.is_correct
      ) s
    )
  );
end;
$$;

-- ============ Resume support ============
-- The runner must survive a reload: without the saved choices a reopened exam would
-- look unanswered, and a reload after submitting would look like a live paper. This
-- adds the saved selections, the counts, and the rules the runner needs to behave.
create or replace function public.get_attempt_snapshot(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.user_id <> v_user_id and not public.is_course_staff(public.course_of_assessment(att.assessment_id)) then
    raise exception 'Not authorised to view this attempt';
  end if;

  select * into a from public.assessments where id = att.assessment_id;

  return jsonb_build_object(
    'attempt_id', att.id,
    'assessment_id', att.assessment_id,
    'title', a.title,
    'pass_mark', a.pass_mark,
    'status', att.status,
    'attempt_no', att.attempt_no,
    'started_at', att.started_at,
    'expires_at', att.expires_at,
    'duration_minutes', a.duration_minutes,
    'randomize_options', a.randomize_options,
    'show_correct_answers', a.show_correct_answers,
    'question_order', att.question_order,
    'question_count', jsonb_array_length(att.question_order),
    'answered_count', (
      select count(*)::int from public.attempt_answers aa
      where aa.attempt_id = att.id and aa.selected_option_id is not null
    ),
    'questions', (
      select coalesce(jsonb_agg(s.q_json order by s.ord), '[]'::jsonb)
      from (
        select
          ids.ord,
          jsonb_build_object(
            'id', q.id,
            'stem_md', q.stem_md,
            'points', q.points,
            'type', q.type,
            'selected_option_id', aa.selected_option_id,
            'options', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text)
                  order by o.position, o.label
                ),
                '[]'::jsonb
              )
              from public.question_options o
              where o.question_id = q.id
            )
          ) as q_json
        from jsonb_array_elements_text(att.question_order) with ordinality as ids(id, ord)
        join public.questions q on q.id = ids.id::uuid
        left join public.attempt_answers aa
          on aa.attempt_id = att.id and aa.question_id = q.id
      ) s
    )
  );
end;
$$;

-- ============ Grants ============
-- PostgREST only exposes functions to roles that hold EXECUTE.
grant execute on function public.mark_attempt_internal(uuid, text) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.assessment_centre(uuid) to authenticated;
grant execute on function public.theory_eligibility(uuid, uuid) to authenticated;
grant execute on function public.is_enrolled_for(uuid, uuid) to authenticated;
grant execute on function public.is_course_staff_for(uuid, uuid) to authenticated;

-- Learners should not be able to close their own attempt by writing the row directly.
drop policy if exists assessment_attempts_write on public.assessment_attempts;
create policy assessment_attempts_write on public.assessment_attempts
  for update to authenticated
  using (user_id = auth.uid() and status = 'in_progress')
  with check (user_id = auth.uid());


-- =========================================================================
-- MIGRATION: 0008_theory_exam.sql
-- =========================================================================

-- LIS 815 LMS - 0008_theory_exam.sql
-- Phase 7: the parts of the 5-of-7 theory examination the earlier migrations left out.
--   * save_theory_answer()          - autosave with a word count, expiry reported not raised
--   * submit_theory_submission()    - the clock no longer rolls the closure back
--   * enforce_theory_submission_rules() - the exactly-5 rule as a trigger, not just an RPC
--   * get_theory_workspace()        - the learner's own view (never a model answer)
--   * theory_grading_queue()        - staff queue of papers that are actually in for marking
--   * get_theory_grading_view()     - staff view WITH model answers, behind the grade permission
--   * get_theory_result()           - the released result, model answers never included
--   * claim_theory_submission()     - draft -> submitted -> under_review -> graded -> released
--   * grade_theory_answer()         - refuses drafts, records before/after on a re-grade
--   * set_theory_overall_feedback() - overall comments without touching release's signature
--
-- Every function here keeps the signature it already had in 0002, because
-- "create or replace" cannot change a return type and each file has to stay
-- re-appliable on its own.
--
-- Idempotent: safe to re-run.

-- The word count on the paper is derived, so it lives on the row the trigger fills in.
alter table public.theory_submissions
  add column if not exists total_words int not null default 0 check (total_words >= 0);

-- ============ Autosave ============

create or replace function public.save_theory_answer(p_answer_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ta.*, sub.status as submission_status, sub.expires_at as expires_at
  into a
  from public.theory_answers ta
  join public.theory_submissions sub on sub.id = ta.submission_id
  where ta.id = p_answer_id and sub.user_id = v_user_id;

  if not found then
    raise exception 'Answer not found';
  end if;

  if a.status = 'not_selected' then
    raise exception 'Select this question before writing an answer';
  end if;

  if a.submission_status <> 'draft' then
    raise exception 'This submission is locked and can no longer be edited';
  end if;

  -- The same rule as the objective paper: report the expiry, do not raise, because a
  -- raise would roll back the submission we are about to close.
  if a.expires_at is not null and now() > a.expires_at then
    update public.theory_submissions
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = a.submission_id and status = 'draft';

    return jsonb_build_object(
      'answer_id', p_answer_id,
      'saved', false,
      'expired', true,
      'status', 'submitted',
      'reason', 'Time is up. What you had written has been submitted for marking.'
    );
  end if;

  v_count := case
    when trim(coalesce(p_text, '')) = '' then 0
    else array_length(regexp_split_to_array(trim(coalesce(p_text, '')), '\s+'), 1)
  end;

  update public.theory_answers
  set answer_text = coalesce(p_text, ''),
      word_count = greatest(v_count, 0),
      updated_at = now()
  where id = p_answer_id;

  return jsonb_build_object(
    'answer_id', p_answer_id,
    'saved', true,
    'expired', false,
    'status', 'draft',
    'word_count', greatest(v_count, 0),
    'saved_at', now()
  );
end;
$$;

-- ============ The exactly-5 rule as a trigger ============
-- The RPCs enforce it; this enforces it for every other route into the table, so a
-- direct write cannot produce a submitted paper with four answers. It also owns the
-- derived columns (which five, how long, when it closed) so every closure path fills
-- them in the same way.
--
-- Out of time is the one exception: a paper that ran out of the clock is closed with
-- whatever was written, because refusing to close it would strand the learner with a
-- draft that can never be marked.

create or replace function public.enforce_theory_submission_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_selected int;
  v_empty int;
  v_out_of_time boolean;
begin
  if new.status is distinct from 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new; -- already closed; grading and release are not affected
  end if;

  v_out_of_time := new.expires_at is not null and now() > new.expires_at;

  select
    count(*) filter (where ta.status <> 'not_selected'),
    count(*) filter (where ta.status <> 'not_selected' and btrim(ta.answer_text) = ''),
    coalesce(sum(ta.word_count) filter (where ta.status <> 'not_selected'), 0)
  into v_selected, v_empty, new.total_words
  from public.theory_answers ta
  where ta.submission_id = new.id;

  if not v_out_of_time then
    if v_selected <> 5 then
      raise exception 'A submitted theory paper must answer exactly 5 questions (found %)', v_selected;
    end if;
    if v_empty > 0 then
      raise exception 'A submitted theory paper cannot contain an empty answer';
    end if;
  end if;

  new.selected_question_ids := coalesce(
    (select array_agg(ta.question_id order by ta.question_id)
     from public.theory_answers ta
     where ta.submission_id = new.id and ta.status <> 'not_selected'),
    '{}'::uuid[]
  );
  new.submitted_at := coalesce(new.submitted_at, now());
  return new;
end;
$$;

drop trigger if exists enforce_theory_submission_rules on public.theory_submissions;
create trigger enforce_theory_submission_rules
  before insert or update of status on public.theory_submissions
  for each row execute function public.enforce_theory_submission_rules();

-- ============ Submission ============
-- The earlier version raised on expiry, which discarded the very update that closed the
-- paper and left the learner with a draft that could never be submitted. The clock is
-- reported through save_theory_answer() and the runner's own countdown; here the paper
-- is simply closed. selected_question_ids, submitted_at and total_words are filled in by
-- the trigger, on this path and on every other one.

create or replace function public.submit_theory_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  v_selected int;
  v_empty int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s
  from public.theory_submissions
  where id = p_submission_id and user_id = v_user_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  -- Already closed, including by save_theory_answer() when the clock ran out.
  if s.status <> 'draft' then
    return;
  end if;

  -- Out of time: the trigger allows this, and closes the paper as it stands.
  if s.expires_at is not null and now() > s.expires_at then
    update public.theory_submissions
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = p_submission_id;
    return;
  end if;

  select
    count(*),
    count(*) filter (where btrim(answer_text) = '')
  into v_selected, v_empty
  from public.theory_answers
  where submission_id = p_submission_id and status = 'draft';

  if v_selected <> 5 then
    raise exception 'You must answer exactly 5 questions (currently %)', v_selected;
  end if;

  if v_empty > 0 then
    raise exception 'Every selected question needs an answer before submitting';
  end if;

  update public.theory_submissions
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_submission_id;
end;
$$;

-- ============ The learner's workspace ============

create or replace function public.get_theory_workspace(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.user_id <> v_user_id
     and not public.is_course_staff_for(public.course_of_submission(s.id), v_user_id) then
    raise exception 'Not authorised to view this submission';
  end if;

  select * into a from public.assessments where id = s.assessment_id;

  return jsonb_build_object(
    'submission_id', s.id,
    'assessment_id', a.id,
    'course_id', a.course_id,
    'title', a.title,
    'description', a.description,
    'instructions', a.settings -> 'instructions',
    'pass_mark', a.pass_mark,
    'marks_each', coalesce((a.settings ->> 'marks_each')::int, 20),
    'duration_minutes', a.duration_minutes,
    'status', s.status,
    'total_words', s.total_words,
    'started_at', s.started_at,
    'expires_at', s.expires_at,
    'submitted_at', s.submitted_at,
    'graded_at', s.graded_at,
    'released_at', s.released_at,
    'total_score', s.total_score,
    'overall_feedback', s.overall_feedback,
    'is_staff_view', s.user_id <> v_user_id,
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'position', q.position,
          'stem_md', q.stem_md,
          'points', q.points,
          'module_title', m.title,
          'chapter_title', ch.title,
          'selected', ta.status <> 'not_selected',
          'answer_text', ta.answer_text,
          'word_count', ta.word_count,
          'answer_status', ta.status,
          'answer_id', ta.id
        ) order by q.position
      ), '[]'::jsonb)
      from public.questions q
      join public.theory_answers ta
        on ta.question_id = q.id and ta.submission_id = s.id
      left join public.chapters ch on ch.id = q.chapter_id
      left join public.modules m on m.id = ch.module_id
      where q.assessment_id = a.id and q.status = 'published'
    )
  );
end;
$$;

-- ============ Staff: the grading queue ============
-- A draft is not work. It is a paper nobody has handed in yet, and leaving it in the
-- queue meant staff could "grade" a learner's unfinished thinking.

create or replace function public.theory_grading_queue(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff boolean;
  v_pass int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  v_staff := public.is_course_staff_for(p_course_id, v_user_id);
  if not v_staff then
    raise exception 'Not authorised to view the grading queue';
  end if;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);

  return jsonb_build_object(
    'pass_mark', v_pass,
    'submissions', (
      select coalesce(jsonb_agg(s.s_json order by
        case s.status when 'submitted' then 0 when 'under_review' then 1 else 2 end,
        s.submitted_at nulls last
      ), '[]'::jsonb)
      from (
        select
          ts.status as status,
          ts.submitted_at as submitted_at,
          jsonb_build_object(
            'id', ts.id,
            'user_id', ts.user_id,
            'learner_name', nullif(trim(coalesce(p.full_name, '')), ''),
            'learner_email', p.email,
            'status', ts.status,
            'total_words', ts.total_words,
            'started_at', ts.started_at,
            'expires_at', ts.expires_at,
            'submitted_at', ts.submitted_at,
            'graded_at', ts.graded_at,
            'released_at', ts.released_at,
            'total_score', ts.total_score,
            'graded_count', (
              select count(*)::int
              from public.theory_grades g
              join public.theory_answers ta on ta.id = g.theory_answer_id
              where ta.submission_id = ts.id
            ),
            'answer_count', (
              select count(*)::int
              from public.theory_answers ta
              where ta.submission_id = ts.id and ta.status <> 'not_selected'
            )
          ) as s_json
        from public.theory_submissions ts
        join public.profiles p on p.id = ts.user_id
        where public.course_of_submission(ts.id) = p_course_id
          and ts.status <> 'draft'
      ) s
    )
  );
end;
$$;

-- ============ Staff: one paper to mark ============

create or replace function public.get_theory_grading_view(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  a record;
  v_learner record;
  v_course_id uuid;
  v_pass int;
  v_marks_each int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  v_course_id := public.course_of_submission(s.id);
  if not public.is_course_staff_for(v_course_id, v_user_id)
     or not public.has_permission('assessment.grade') then
    raise exception 'Not authorised to grade this submission';
  end if;

  select * into a from public.assessments where id = s.assessment_id;
  select * into v_learner from public.profiles where id = s.user_id;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);
  v_marks_each := coalesce((a.settings ->> 'marks_each')::int, 20);

  return jsonb_build_object(
    'submission_id', s.id,
    'assessment_id', a.id,
    'course_id', v_course_id,
    'title', a.title,
    'status', s.status,
    'learner', jsonb_build_object(
      'id', s.user_id,
      'name', v_learner.full_name,
      'email', v_learner.email
    ),
    'total_words', s.total_words,
    'started_at', s.started_at,
    'expires_at', s.expires_at,
    'submitted_at', s.submitted_at,
    'graded_at', s.graded_at,
    'released_at', s.released_at,
    'total_score', s.total_score,
    'max_score', v_marks_each * 5,
    'pass_mark', v_pass,
    'overall_feedback', s.overall_feedback,
    'marks_each', v_marks_each,
    'model_answer_caveat', 'Model answers are indicative and not exhaustive. They show the expected shape of a good answer, not the only acceptable one. Award credit for any sound, well-evidenced response.',
    'answers', (
      select coalesce(jsonb_agg(s2.a_json order by s2.ord), '[]'::jsonb)
      from (
        select
          q.position as ord,
          jsonb_build_object(
            'answer_id', ta.id,
            'question_id', q.id,
            'position', q.position,
            'stem_md', q.stem_md,
            'points', q.points,
            'source_ref', q.source_ref,
            'module_title', m.title,
            'chapter_title', ch.title,
            'answer_text', ta.answer_text,
            'word_count', ta.word_count,
            'model_answer_md', q.model_answer_md,
            'score', g.score,
            'feedback', g.feedback,
            'rubric_ref', g.rubric_ref,
            'graded_at', g.graded_at
          ) as a_json
        from public.theory_answers ta
        join public.questions q on q.id = ta.question_id
        left join public.theory_grades g on g.theory_answer_id = ta.id
        left join public.chapters ch on ch.id = q.chapter_id
        left join public.modules m on m.id = ch.module_id
        where ta.submission_id = s.id and ta.status <> 'not_selected'
      ) s2
    )
  );
end;
$$;

-- ============ The learner: the released result ============

create or replace function public.get_theory_result(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  a record;
  v_pass int;
  v_marks_each int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.user_id <> v_user_id
     and not public.is_course_staff_for(public.course_of_submission(s.id), v_user_id) then
    raise exception 'Not authorised to view this submission';
  end if;
  if s.status <> 'released' then
    raise exception 'Your result has not been released yet';
  end if;

  select * into a from public.assessments where id = s.assessment_id;
  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);
  v_marks_each := coalesce((a.settings ->> 'marks_each')::int, 20);

  return jsonb_build_object(
    'submission_id', s.id,
    'course_id', a.course_id,
    'title', a.title,
    'status', s.status,
    'total_words', s.total_words,
    'submitted_at', s.submitted_at,
    'graded_at', s.graded_at,
    'released_at', s.released_at,
    'total_score', s.total_score,
    'max_score', v_marks_each * 5,
    'pass_mark', v_pass,
    'passed', coalesce(s.total_score, 0) >= v_pass,
    'overall_feedback', s.overall_feedback,
    'answers', (
      select coalesce(jsonb_agg(s2.a_json order by s2.ord), '[]'::jsonb)
      from (
        select
          q.position as ord,
          jsonb_build_object(
            'position', q.position,
            'stem_md', q.stem_md,
            'points', q.points,
            'source_ref', q.source_ref,
            'answer_text', ta.answer_text,
            'word_count', ta.word_count,
            'score', g.score,
            'max_score', coalesce((a.settings ->> 'marks_each')::int, 20),
            'feedback', g.feedback,
            'rubric_ref', g.rubric_ref
          ) as a_json
        from public.theory_answers ta
        join public.questions q on q.id = ta.question_id
        left join public.theory_grades g on g.theory_answer_id = ta.id
        where ta.submission_id = s.id and ta.status <> 'not_selected'
      ) s2
    )
  );
end;
$$;

-- ============ Claiming a paper for marking ============

create or replace function public.claim_theory_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if not public.is_course_staff_for(public.course_of_submission(s.id), v_user_id) then
    raise exception 'Not authorised to claim this submission';
  end if;
  if s.status not in ('submitted', 'under_review') then
    raise exception 'Only a submitted paper can be claimed';
  end if;

  update public.theory_submissions
  set status = 'under_review', graded_by = v_user_id, updated_at = now()
  where id = p_submission_id
    and (graded_by is null or graded_by = v_user_id or status = 'submitted');

  perform public.log_audit(
    'theory.claimed', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('by', v_user_id)
  );

  return jsonb_build_object('submission_id', p_submission_id, 'status', 'under_review');
end;
$$;

-- ============ Grading, with before/after on a re-grade ============
-- Two real gaps in the earlier version: it could mark a paper that was still a draft,
-- and a re-grade overwrote the score with nothing in the audit log to show what it was.

create or replace function public.grade_theory_answer(
  p_theory_answer_id uuid,
  p_score numeric,
  p_feedback text default null,
  p_rubric_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid;
  v_answer_status text;
  v_submission record;
  v_before record;
  v_total numeric;
  v_graded int;
  v_needed int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to grade';
  end if;

  if p_score is null or p_score < 0 or p_score > 20 then
    raise exception 'Score must be between 0 and 20';
  end if;

  select ta.submission_id, ta.status into v_submission_id, v_answer_status
  from public.theory_answers ta
  where ta.id = p_theory_answer_id;

  if v_submission_id is null then
    raise exception 'Theory answer not found';
  end if;

  -- A question the learner never chose carries no mark, and letting one in would put a
  -- score on a blank space and throw the total out.
  if v_answer_status = 'not_selected' then
    raise exception 'That question was not answered on this paper';
  end if;

  select * into v_submission from public.theory_submissions where id = v_submission_id;

  if v_submission.status = 'draft' then
    raise exception 'This paper has not been submitted yet';
  end if;

  if not public.is_course_staff_for(public.course_of_submission(v_submission_id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to grade this paper';
  end if;

  select g.score, g.feedback
  into v_before
  from public.theory_grades g
  where g.theory_answer_id = p_theory_answer_id;

  insert into public.theory_grades (theory_answer_id, score, feedback, graded_by, rubric_ref)
  values (p_theory_answer_id, p_score, p_feedback, auth.uid(), p_rubric_ref)
  on conflict (theory_answer_id) do update
    set score = excluded.score,
        feedback = excluded.feedback,
        graded_by = excluded.graded_by,
        rubric_ref = excluded.rubric_ref,
        graded_at = now();

  update public.theory_answers
  set status = 'graded', updated_at = now()
  where id = p_theory_answer_id;

  select
    coalesce(sum(g.score), 0),
    count(*),
    coalesce((select count(*) from public.theory_answers ta2
              where ta2.submission_id = v_submission_id
                and ta2.status <> 'not_selected'), 5)
  into v_total, v_graded, v_needed
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = v_submission_id;

  -- All five answered questions graded means the paper is finished, not before: a
  -- half-marked paper must not read as a result.
  update public.theory_submissions
  set total_score = v_total,
      graded_at = now(),
      graded_by = coalesce(graded_by, auth.uid()),
      status = case
        when v_submission.status = 'released' then 'released'
        when v_graded >= v_needed then 'graded'
        else 'under_review'
      end,
      updated_at = now()
  where id = v_submission_id;

  perform public.log_audit(
    'theory.answer_graded', 'theory_answers', p_theory_answer_id::text, null,
    jsonb_build_object(
      'submission_id', v_submission_id,
      'score', p_score,
      'rubric_ref', p_rubric_ref,
      'regrade', v_before.score is not null,
      'before', case
        when v_before.score is null then null
        else jsonb_build_object('score', v_before.score, 'feedback', v_before.feedback)
      end,
      'after', jsonb_build_object('score', p_score, 'feedback', p_feedback)
    )
  );
end;
$$;

-- Overall feedback is its own call, so release_theory_grade keeps its one argument and
-- the grading screen can save a comment without touching release.

create or replace function public.set_theory_overall_feedback(
  p_submission_id uuid,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to write feedback';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if not public.is_course_staff_for(public.course_of_submission(s.id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to write feedback on this paper';
  end if;
  if s.status = 'draft' then
    raise exception 'This paper has not been submitted yet';
  end if;

  update public.theory_submissions
  set overall_feedback = nullif(btrim(coalesce(p_feedback, '')), ''), updated_at = now()
  where id = p_submission_id;

  perform public.log_audit(
    'theory.feedback_set', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('length', length(coalesce(p_feedback, '')))
  );
end;
$$;

-- ============ Release ============
-- The earlier version released a paper whose status happened to be 'graded' without
-- checking that all five answered questions actually carried a mark, which could
-- release a half-marked paper with a total of 20 out of 100.

create or replace function public.release_theory_grade(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_graded int;
  v_needed int;
  v_pass int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to release grades';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  if not public.is_course_staff_for(public.course_of_submission(s.id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to release this paper';
  end if;

  if s.status = 'released' then
    return;
  end if;
  if s.status not in ('graded', 'under_review') then
    raise exception 'Every answer must be graded before release (this paper is %)', s.status;
  end if;

  select
    count(*),
    coalesce((select count(*) from public.theory_answers ta2
              where ta2.submission_id = s.id and ta2.status <> 'not_selected'), 5)
  into v_graded, v_needed
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = s.id;

  if v_graded < v_needed then
    raise exception 'Only % of % answers are graded', v_graded, v_needed;
  end if;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);

  update public.theory_submissions
  set status = 'released', released_at = coalesce(released_at, now()), updated_at = now()
  where id = p_submission_id;

  perform public.notify(
    s.user_id,
    'grade_released',
    'Theory examination graded',
    case when coalesce(s.total_score, 0) >= v_pass
      then 'You passed. Your marked paper and feedback are available.'
      else 'Your marked paper and feedback are available.'
    end,
    '/dashboard/theory/results/' || p_submission_id
  );

  perform public.log_audit(
    'theory.released', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('total_score', s.total_score, 'by', auth.uid())
  );
end;
$$;

-- ============ Grants, and no direct writes ============
grant execute on function public.save_theory_answer(uuid, text) to authenticated;
grant execute on function public.submit_theory_submission(uuid) to authenticated;
grant execute on function public.get_theory_workspace(uuid) to authenticated;
grant execute on function public.get_theory_result(uuid) to authenticated;
grant execute on function public.theory_grading_queue(uuid) to authenticated;
grant execute on function public.get_theory_grading_view(uuid) to authenticated;
grant execute on function public.claim_theory_submission(uuid) to authenticated;
grant execute on function public.grade_theory_answer(uuid, numeric, text, text) to authenticated;
grant execute on function public.set_theory_overall_feedback(uuid, text) to authenticated;
grant execute on function public.release_theory_grade(uuid) to authenticated;

-- Every write to a theory table goes through a security definer function above, which
-- re-checks ownership, the draft state and the clock. The write policies that were here
-- are removed because row-level security cannot narrow *which columns* a policy covers:
-- a learner with an update policy on their own draft could set expires_at to next year
-- and invent their own total_score. With no update policy the statement simply matches
-- zero rows, which is the correct answer for every direct write.
drop policy if exists theory_submissions_write on public.theory_submissions;
drop policy if exists theory_answers_update on public.theory_answers;


-- =========================================================================
-- MIGRATION: 0009_study_tooling.sql
-- =========================================================================

-- ============================================================
-- 0009 - Study tooling hardening (Phase 8)
--
-- Two rules the learner UI depends on, written where they cannot
-- be forgotten:
--
--   1. An examination paper is never a student resource, whatever
--      the visibility column says. Students sit the paper inside
--      the platform, where it is timed and marked for them.
--   2. A notification is written by the system and only ever read
--      by its owner. RLS already scopes the rows; this guard stops
--      an owner from rewriting their own title, link or body and
--      passing a forged message off as a platform notification.
-- ============================================================

-- ---------- 1. exam papers stay staff-side ----------

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and visibility = 'students'
      and kind <> 'exam_paper'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = resources.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

-- ---------- 2. notifications: read_at is the only editable field ----------

create or replace function public.notification_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.link is distinct from old.link
     or new.created_at is distinct from old.created_at then
    raise exception
      'A notification can only be marked read - its text and its recipient are set by the system.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard
  before update on public.notifications
  for each row
  execute function public.notification_guard();


-- =========================================================================
-- MIGRATION: 0010_released_marks_only.sql
-- =========================================================================

-- 0010 - the mark stays off the learner's row until release.
--
-- A learner may read their own theory_submissions row (that is how the "where is my
-- paper" list is built), so anything written there is readable by them. grade_theory_answer()
-- used to publish a running total after the first answer was marked, which handed a
-- half-marked paper's score to the learner days before the marker released it. Two changes
-- follow from that: the total is only written once every answer carries a mark, and a row
-- that holds a mark the learner has not been given yet cannot be selected by them at all.

create or replace function public.grade_theory_answer(
  p_theory_answer_id uuid,
  p_score numeric,
  p_feedback text default null,
  p_rubric_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid;
  v_answer_status text;
  v_submission record;
  v_before record;
  v_total numeric;
  v_graded int;
  v_needed int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to grade';
  end if;

  if p_score is null or p_score < 0 or p_score > 20 then
    raise exception 'Score must be between 0 and 20';
  end if;

  select ta.submission_id, ta.status into v_submission_id, v_answer_status
  from public.theory_answers ta
  where ta.id = p_theory_answer_id;

  if v_submission_id is null then
    raise exception 'Theory answer not found';
  end if;

  -- A question the learner never chose carries no mark, and letting one in would put a
  -- score on a blank space and throw the total out.
  if v_answer_status = 'not_selected' then
    raise exception 'That question was not answered on this paper';
  end if;

  select * into v_submission from public.theory_submissions where id = v_submission_id;

  if v_submission.status = 'draft' then
    raise exception 'This paper has not been submitted yet';
  end if;

  -- A released paper is the mark the learner has already been given. Changing it behind
  -- their back would make the result they can read differ from the result on record, so
  -- the answer is no: corrections have to be asked for, not slipped in.
  if v_submission.status = 'released' then
    raise exception 'This paper has been released and can no longer be marked';
  end if;

  if not public.is_course_staff_for(public.course_of_submission(v_submission_id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to grade this paper';
  end if;

  select g.score, g.feedback
  into v_before
  from public.theory_grades g
  where g.theory_answer_id = p_theory_answer_id;

  insert into public.theory_grades (theory_answer_id, score, feedback, graded_by, rubric_ref)
  values (p_theory_answer_id, p_score, p_feedback, auth.uid(), p_rubric_ref)
  on conflict (theory_answer_id) do update
    set score = excluded.score,
        feedback = excluded.feedback,
        graded_by = excluded.graded_by,
        rubric_ref = excluded.rubric_ref,
        graded_at = now();

  update public.theory_answers
  set status = 'graded', updated_at = now()
  where id = p_theory_answer_id;

  select
    coalesce(sum(g.score), 0),
    count(*),
    coalesce((select count(*) from public.theory_answers ta2
              where ta2.submission_id = v_submission_id
                and ta2.status <> 'not_selected'), 5)
  into v_total, v_graded, v_needed
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = v_submission_id;

  -- All five answered questions graded means the paper is finished, not before: a
  -- half-marked paper must not read as a result, and until then total_score stays null
  -- so the row never carries a mark the learner is not meant to have.
  update public.theory_submissions
  set total_score = case when v_graded >= v_needed then v_total else total_score end,
      graded_at = case when v_graded >= v_needed then now() else graded_at end,
      graded_by = case when v_graded >= v_needed then coalesce(graded_by, auth.uid()) else graded_by end,
      status = case
        when v_submission.status = 'released' then 'released'
        when v_graded >= v_needed then 'graded'
        else 'under_review'
      end,
      updated_at = now()
  where id = v_submission_id;

  perform public.log_audit(
    'theory.answer_graded', 'theory_answers', p_theory_answer_id::text, null,
    jsonb_build_object(
      'submission_id', v_submission_id,
      'score', p_score,
      'rubric_ref', p_rubric_ref,
      'regrade', v_before.score is not null,
      'before', case
        when v_before.score is null then null
        else jsonb_build_object('score', v_before.score, 'feedback', v_before.feedback)
      end,
      'after', jsonb_build_object('score', p_score, 'feedback', p_feedback)
    )
  );
end;
$$;

-- Releasing twice used to return quietly, which tells the marker nothing: they cannot
-- tell an already-released paper from one the button failed on. The second release says
-- what happened instead. (The other half of this rule - no re-marking after release -
-- lives in grade_theory_answer above.)

create or replace function public.release_theory_grade(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_graded int;
  v_needed int;
  v_pass int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to release grades';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  if not public.is_course_staff_for(public.course_of_submission(s.id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to release this paper';
  end if;

  if s.status = 'released' then
    raise exception 'This paper has already been released';
  end if;
  if s.status not in ('graded', 'under_review') then
    raise exception 'Every answer must be graded before release (this paper is %)', s.status;
  end if;

  select
    count(*),
    coalesce((select count(*) from public.theory_answers ta2
              where ta2.submission_id = s.id and ta2.status <> 'not_selected'), 5)
  into v_graded, v_needed
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = s.id;

  if v_graded < v_needed then
    raise exception 'Only % of % answers are graded', v_graded, v_needed;
  end if;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);

  update public.theory_submissions
  set status = 'released', released_at = coalesce(released_at, now()), updated_at = now()
  where id = p_submission_id;

  perform public.notify(
    s.user_id,
    'grade_released',
    'Theory examination graded',
    case when coalesce(s.total_score, 0) >= v_pass
      then 'You passed. Your marked paper and feedback are available.'
      else 'Your marked paper and feedback are available.'
    end,
    '/dashboard/theory/results/' || p_submission_id
  );

  perform public.log_audit(
    'theory.released', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('total_score', s.total_score, 'by', auth.uid())
  );
end;
$$;

-- The learner keeps their own paper while it is being written, submitted and marked up,
-- and sees it again the moment it is released. What they never get is a row carrying a
-- total_score they have not been given: released_at is what turns that column on for them.
drop policy if exists theory_submissions_select on public.theory_submissions;
create policy theory_submissions_select on public.theory_submissions
  for select to authenticated
  using (
    (
      user_id = auth.uid()
      and (total_score is null or released_at is not null)
    )
    or public.is_course_staff(public.course_of_submission(theory_submissions.id))
  );


-- =========================================================================
-- MIGRATION: 0011_reporting.sql
-- =========================================================================

create or replace function public.admin_dashboard_stats(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff boolean;
  v_pass_mark int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  v_staff := public.is_course_staff_for(p_course_id, v_user_id);
  if not v_staff then
    raise exception 'Not authorised to view dashboard stats';
  end if;

  v_pass_mark := coalesce(public.get_setting_int('objective_pass_mark', 50), 50);

  return jsonb_build_object(
    'learners', (
      select count(*)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id
        and ce.status in ('active', 'completed')
    ),
    'active_learners', (
      select count(distinct ce.user_id)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id
        and ce.status in ('active', 'completed')
        and exists (
          select 1 from public.reading_events re
          where re.user_id = ce.user_id and re.created_at >= now() - interval '14 days'
          union
          select 1 from public.lesson_progress lp
          where lp.user_id = ce.user_id and lp.completed_at >= now() - interval '14 days'
        )
    ),
    'completion_rate', coalesce((
      select round(avg(ce.progress_pct), 2)
      from public.course_enrollments ce
      where ce.course_id = p_course_id and ce.status = 'active'
    ), 0),
    'attempts', (
      select count(*)::int
      from public.assessment_attempts aa
      join public.assessments a on a.id = aa.assessment_id
      where a.course_id = p_course_id
        and aa.status in ('submitted', 'marked')
    ),
    'avg_score', coalesce((
      select round(avg(aa.percentage), 2)
      from public.assessment_attempts aa
      join public.assessments a on a.id = aa.assessment_id
      where a.course_id = p_course_id
        and aa.status in ('submitted', 'marked')
    ), 0),
    'theory_eligible', (
      select count(*)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id and ce.status = 'active'
        and coalesce(public.best_objective_percentage(p_course_id, ce.user_id), 0) >= v_pass_mark
    ),
    'grading_queue', (
      select count(*)::int
      from public.theory_submissions ts
      where public.course_of_submission(ts.id) = p_course_id
        and ts.status in ('submitted', 'under_review')
    ),
    'completions', (
      select count(*)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id and ce.status = 'completed'
    ),
    'certificates', (
      select count(*)::int
      from public.certificates c
      where c.course_id = p_course_id and c.status = 'issued'
    ),
    'recent_registrations', (
      select count(*)::int
      from public.profiles p
      where p.created_at >= now() - interval '30 days'
    ),
    'engagement', (
      select coalesce(jsonb_agg(row_to_json(e) order by e.completed desc), '[]'::jsonb)
      from (
        select m.id, m.title, count(*)::int as completed
        from public.lesson_progress lp
        join public.lessons l on l.id = lp.lesson_id
        join public.chapters c on c.id = l.chapter_id
        join public.modules m on m.id = c.module_id
        where m.course_id = p_course_id and lp.status = 'completed'
        group by m.id, m.title
        order by completed desc
        limit 6
      ) e
    )
  );
end;
$$;

create or replace function public.question_analytics(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_course uuid;
  v_staff boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  select a.course_id into v_course from public.assessments a where a.id = p_assessment_id;
  if v_course is null then
    raise exception 'Assessment not found';
  end if;
  v_staff := public.is_course_staff_for(v_course, v_user_id);
  if not v_staff then
    raise exception 'Not authorised to view question analytics';
  end if;

  return jsonb_build_object(
    'assessment_id', p_assessment_id,
    'questions', (
      select coalesce(jsonb_agg(q_json order by q.position), '[]'::jsonb)
      from (
        select
          q.id, q.position, q.stem_md, q.type, q.points,
          (
            select count(*)::int
            from public.attempt_answers aa
            where aa.question_id = q.id
          ) as n_attempts,
          (
            select count(*)::int
            from public.attempt_answers aa
            where aa.question_id = q.id and aa.is_correct = true
          ) as correct_count,
          case
            when (select count(*)::int from public.attempt_answers aa where aa.question_id = q.id) > 0
            then round(
              (select count(*)::numeric
               from public.attempt_answers aa
               where aa.question_id = q.id and aa.is_correct = true)
              / (select count(*)::numeric
                 from public.attempt_answers aa
                 where aa.question_id = q.id), 2)
            else null
          end as difficulty_index,
          (
            select coalesce(jsonb_agg(o_json order by o.label), '[]'::jsonb)
            from (
              select
                o.label, o.text, o.is_correct,
                (select count(*)::int from public.attempt_answers aa where aa.selected_option_id = o.id) as times_chosen
              from public.question_options o
              where o.question_id = q.id
              order by o.position
            ) o_json
          ) as options
        from public.questions q
        where q.assessment_id = p_assessment_id
          and q.status = 'published'
          and q.type = 'mcq'
      ) q_json
    )
  );
end;
$$;

create or replace function public.admin_report(p_course_id uuid, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_course_staff_for(p_course_id, v_user_id) then
    raise exception 'Not authorised';
  end if;

  if p_kind = 'learners' then
    return (
      select jsonb_build_object('rows', coalesce(jsonb_agg(r order by r.full_name, r.email), '[]'::jsonb))
      from (
        select
          p.id as user_id, p.full_name, p.email,
          ce.enrolled_at, ce.progress_pct, ce.required_lessons_done,
          coalesce(public.best_objective_percentage(p_course_id, p.id), 0) as best_objective,
          ts.status as theory_status, ts.total_score as theory_score, ts.released_at,
          ce.status, ce.completed_at,
          greatest(coalesce(re.last_active, lp.last_active, ce.enrolled_at)) as last_active
        from public.profiles p
        join public.course_enrollments ce on ce.user_id = p.id and ce.course_id = p_course_id
        left join (
          select user_id, max(created_at) as last_active
          from public.reading_events group by user_id
        ) re on re.user_id = p.id
        left join (
          select user_id, max(completed_at) as last_active
          from public.lesson_progress where status = 'completed' group by user_id
        ) lp on lp.user_id = p.id
        left join lateral (
          select ts2.status, ts2.total_score, ts2.released_at
          from public.theory_submissions ts2
          where ts2.user_id = p.id
            and ts2.assessment_id in (select id from public.assessments where course_id = p_course_id and type = 'theory')
          order by ts2.submitted_at desc
          limit 1
        ) ts on true
      ) r
    );
  elsif p_kind = 'attempts' then
    return (
      select jsonb_build_object('rows', coalesce(jsonb_agg(r order by r.submitted_at desc nulls last), '[]'::jsonb))
      from (
        select
          p.email, a.type as assessment_type, a.title, aa.attempt_no,
          aa.status, aa.percentage, aa.started_at, aa.submitted_at, aa.marked_at
        from public.assessment_attempts aa
        join public.assessments a on a.id = aa.assessment_id
        join public.profiles p on p.id = aa.user_id
        where a.course_id = p_course_id
      ) r
    );
  elsif p_kind = 'grades' then
    return (
      select jsonb_build_object('rows', coalesce(jsonb_agg(r order by r.released_at desc nulls last), '[]'::jsonb))
      from (
        select
          p.email, a.title, a.type,
          ts.total_score, ts.graded_at, ts.released_at, ts.status
        from public.theory_submissions ts
        join public.profiles p on p.id = ts.user_id
        join public.assessments a on a.id = ts.assessment_id
        where a.course_id = p_course_id and ts.status in ('graded', 'released')
        union all
        select
          p.email, a.title, 'objective',
          aa.percentage, aa.marked_at, null, aa.status
        from public.assessment_attempts aa
        join public.assessments a on a.id = aa.assessment_id
        join public.profiles p on p.id = aa.user_id
        where a.course_id = p_course_id and a.type = 'objective' and aa.status = 'marked'
      ) r
    );
  end if;

  return jsonb_build_object('rows', '[]'::jsonb);
end;
$$;

create or replace function public.move_content_row(p_kind text, p_id uuid, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_course uuid;
  v_other uuid;
  v_pos int;
  v_tmp int := -2147483648;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  if p_kind = 'module' then
    select course_id into v_course from public.modules where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.modules where id = p_id;
    select id into v_other from public.modules
      where course_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.modules set position = v_tmp where id = p_id;
    update public.modules set position = v_pos where id = v_other;
    update public.modules set position = v_pos + p_delta where id = p_id;
  elsif p_kind = 'chapter' then
    select module_id into v_course from public.chapters where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.chapters where id = p_id;
    select id into v_other from public.chapters
      where module_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.chapters set position = v_tmp where id = p_id;
    update public.chapters set position = v_pos where id = v_other;
    update public.chapters set position = v_pos + p_delta where id = p_id;
  elsif p_kind = 'lesson' then
    select chapter_id into v_course from public.lessons where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.lessons where id = p_id;
    select id into v_other from public.lessons
      where chapter_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.lessons set position = v_tmp where id = p_id;
    update public.lessons set position = v_pos where id = v_other;
    update public.lessons set position = v_pos + p_delta where id = p_id;
  elsif p_kind = 'section' then
    select lesson_id into v_course from public.lesson_sections where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.lesson_sections where id = p_id;
    select id into v_other from public.lesson_sections
      where lesson_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.lesson_sections set position = v_tmp where id = p_id;
    update public.lesson_sections set position = v_pos where id = v_other;
    update public.lesson_sections set position = v_pos + p_delta where id = p_id;
  else
    raise exception 'Unknown kind: use module, chapter, lesson, section';
  end if;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id);
end;
$$;


-- =========================================================================
-- MIGRATION: 0012_notifications.sql
-- =========================================================================

-- LIS 815 LMS - 0012_notifications.sql
-- Notification preferences and email tracking

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  assessment_reminders boolean not null default true,
  grade_notifications boolean not null default true,
  certificate_notifications boolean not null default true,
  announcements boolean not null default true,
  admin_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.get_notification_preferences(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefs record;
begin
  select * into v_prefs from public.notification_preferences where user_id = p_user_id;
  if not found then
    return jsonb_build_object(
      'email_enabled', true,
      'assessment_reminders', true,
      'grade_notifications', true,
      'certificate_notifications', true,
      'announcements', true,
      'admin_alerts', true
    );
  end if;
  return to_jsonb(v_prefs);
end;
$$;

create or replace function public.set_notification_preferences(
  p_user_id uuid,
  p_email_enabled boolean default null,
  p_assessment_reminders boolean default null,
  p_grade_notifications boolean default null,
  p_certificate_notifications boolean default null,
  p_announcements boolean default null,
  p_admin_alerts boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefs record;
begin
  insert into public.notification_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.notification_preferences
  set
    email_enabled = coalesce(p_email_enabled, email_enabled),
    assessment_reminders = coalesce(p_assessment_reminders, assessment_reminders),
    grade_notifications = coalesce(p_grade_notifications, grade_notifications),
    certificate_notifications = coalesce(p_certificate_notifications, certificate_notifications),
    announcements = coalesce(p_announcements, announcements),
    admin_alerts = coalesce(p_admin_alerts, admin_alerts),
    updated_at = now()
  where user_id = p_user_id;

  select * into v_prefs from public.notification_preferences where user_id = p_user_id;
  return to_jsonb(v_prefs);
end;
$$;

-- Email send log for tracking and debugging
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  subject text not null,
  template_type text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_log_user_idx on public.email_log (user_id, created_at desc);
create index if not exists email_log_status_idx on public.email_log (status, created_at desc);

-- RLS policies
alter table public.notification_preferences enable row level security;
alter table public.email_log enable row level security;

drop policy if exists notification_prefs_select on public.notification_preferences;
create policy notification_prefs_select on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_prefs_update on public.notification_preferences;
create policy notification_prefs_update on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notification_prefs_insert on public.notification_preferences;
create policy notification_prefs_insert on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists email_log_select on public.email_log;
create policy email_log_select on public.email_log
  for select to authenticated using (
    user_id = auth.uid() or public.is_admin()
  );

drop policy if exists email_log_insert on public.email_log;
create policy email_log_insert on public.email_log
  for insert to authenticated with check (true);

-- Grant permissions
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert on public.email_log to authenticated;

