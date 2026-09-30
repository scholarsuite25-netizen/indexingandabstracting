# LIS 815 LMS - Row Level Security in plain English

LIS 815 LMS - what protects every table, how the rules are grouped, how to test them, and what to do when you add a table.

## What Row Level Security is, in one paragraph

Row Level Security, or RLS, is a set of rules kept inside the database itself. Every time a page asks the database for rows, the database checks the rules first and only returns the rows that person is allowed to see. It does not matter what the website screen shows, or whether someone edits the page in their browser, or calls the API directly. If the rule says "your own notes only", then other people's notes are not returned at all. `SECURITY.md` calls this a zero trust model: the database does not trust the client, even when the client is signed in.

## Where the rules live

- `supabase/migrations/0003_rls.sql` is the main file. It turns RLS on for every table in the `public` schema with one loop, then writes the policies.
- `supabase/migrations/0009_study_tooling.sql` tightens two of them: examination papers are never a student resource, and a notification can only be read by its owner and never rewritten by them.
- `supabase/migrations/0010_released_marks_only.sql` keeps a half-marked theory total away from the learner until release.
- `supabase/migrations/0013_certificate_publicity.sql` adds a narrow read for certificate verification (a `SECURITY DEFINER` function, because a policy that only allowed signed-in users made `/verify/[number]` say "not found" for every stranger). `supabase/migrations/0014_verify_requires_login.sql` then takes it back to signed-in callers: `proxy.ts` bounces a signed-out visitor to `/login` before the page renders, and the `anon` role loses `EXECUTE`, so the function cannot be reached around the page either.
- `DATABASE_SCHEMA.md` states the intent: RLS on every user-facing table, students see published course material and their own records, admins manage content, superadmins manage the platform.

## The main policy groups

| Group | Tables (examples) | The rule in short |
|---|---|---|
| Identity | `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `course_staff` | you read your own profile; admins write roles; students cannot change their own role |
| Course structure | `courses`, `modules`, `chapters`, `lessons`, `lesson_sections`, `lesson_prerequisites` | published content for enrolled learners, everything for course staff |
| Learner state | `reading_events`, `course_enrollments`, `lesson_progress` | your own rows; a student has no insert/update/delete policy on `lesson_progress` at all, so writes go through the functions only |
| Assessments | `assessments`, `question_banks`, `questions`, `question_options`, `assessment_attempts`, `attempt_answers` | questions and answer keys are staff-only; a learner writes only their own in-progress attempt |
| Theory examination | `theory_submissions`, `theory_answers`, `theory_grades` | your own paper while it is a draft; grades appear only when the paper is `released` |
| Content support | `resources`, `glossary_terms`, `notes`, `bookmarks`, `announcements`, `notifications` | notes, bookmarks and notifications are `user_id = auth.uid()` only |
| Practicals | `practical_activities`, `practical_submissions` | enrolled learners submit; grading fields are refused by a trigger |
| Outcomes and platform | `certificates`, `system_settings`, `audit_logs`, `search_index`, `rate_limits` | certificates for you or your staff; settings and audit logs for admins; `rate_limits` has no policies at all, so only the service role reaches it |

## How admin and superadmin bypass the student rules

- Policies call small helper functions instead of repeating a test: `public.is_admin()`, `public.is_superadmin()`, `public.is_course_staff(course_id)`, `public.is_enrolled(course_id)` and `public.has_permission(code)`. They are defined in `supabase/migrations/0002_functions.sql`.
- `DECISIONS.md` D14 records the shape of the model: the `admin` role is global, the day-to-day teaching role is course-scoped in `course_staff`, and superadmin additionally manages roles, permissions and profile revocation.
- The service-role key bypasses RLS completely. `SECURITY.md` marks it as a critical secret that must never reach the browser.

## SECURITY DEFINER functions

A `SECURITY DEFINER` function runs with the owner's privileges, so it can read what the caller cannot. This is deliberate: marking an attempt, reading a model answer for a marker, or issuing a certificate must happen somewhere the learner cannot see into. The policy helpers in `0003_rls.sql` (`course_of_lesson`, `course_of_chapter`, `course_of_assessment`, `course_of_question`, `course_of_submission`) are all `SECURITY DEFINER`, so a policy can look up a course without tripping over another policy. The same pattern does the marking in `0007_assessment_engine.sql` and the grading and certificate work in `0008_theory_exam.sql` and `0013_certificate_publicity.sql`.

There is no `exec_sql` function. `DECISIONS.md` D16 rejected a service-role-callable `exec_sql` RPC as a permanent backdoor, and `CHANGELOG.md` repeats the reason. Nothing in this project can run arbitrary SQL through the API.

## Three triggers that back the policies up

Policies decide which rows you may touch. Triggers decide what you may write into them:

- `protect_attempt_answers` stops a learner setting `is_correct` or moving an answer to another attempt.
- `protect_theory_answers` freezes `submission_id`, `question_id` and `status` once written.
- `protect_practical_grading` refuses any learner write to score, feedback, grader or status.

## A worked example

Suppose Ada and Ben are both signed in and both enrolled. Ada opens her notes page. The request carries her session, so `auth.uid()` is Ada's user id, and the `notes_select` policy, which says `user_id = auth.uid()`, returns Ada's rows and nothing else. Ben's rows are never sent to her machine.

Now Ada tries to open Ben's note by putting his note id into the address bar. The row belongs to Ben, the policy says no, and the database returns no rows. The page shows an empty or not-found state instead of his note. No application code had to be clever for that; the database did it. `ARCHITECTURE.md` states the principle: never rely on client-side state for authorization.

## Symptoms of a missing or wrong policy

- A page that works for an admin and shows an empty list for a learner. Either the read policy is missing, or it is written for the wrong role.
- An error saying the row was not found when you know it exists. A policy is filtering it out.
- A write that fails with a permission error on a table you expected to be editable. The `with check` clause does not match the `using` clause.
- A policy you wrote but forgot to enable. A table with RLS off is open to everyone who can reach it, which is the opposite failure and the reason step 2 below exists.

## How to test the rules

```
npm run test:rls
```

- Needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, and the migrations applied.
- It creates temporary users and courses, tries the things a student should not be able to do, and deletes everything afterwards.
- It prints `Result: N passed, N failed` and exits non-zero if anything failed.
- `npm run test:all` runs it as the third suite. `.github/workflows/ci.yml` runs the whole live suite only when those three keys are set as repository secrets, so a fresh clone is skipped rather than failed.

## What you must do when a new table is added

1. Write the policies in a new migration under `supabase/migrations/`, following the pattern in `0003_rls.sql`: `drop policy if exists` first, then `create policy`, to `authenticated`, with `using` and `with check`.
2. Turn RLS on. `0003_rls.sql` loops over the tables that exist when it runs, so a table you create later is not covered by that loop. Add an explicit `alter table ... enable row level security` in your own migration. `supabase/migrations/0012_notifications.sql` is the example to copy: it creates two tables, turns RLS on for both, then writes the policies.
3. Add at least one row to `scripts/rls-tests.mjs`: one case for what a learner must be able to do, and one for what they must not.
4. Run `npm run check:sql` first, then `npm run test:rls`.
5. If the table holds grades, answers or settings, consider whether a guard trigger like the three above is also needed.

See `DATABASE_SCHEMA.md` for the table list and `SECURITY.md` for the role list.
