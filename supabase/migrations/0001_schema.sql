-- LIS 815 LMS — 0001_schema.sql
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
