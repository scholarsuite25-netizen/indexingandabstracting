# IMPLEMENTATION CHECKLIST — LIS 815 LMS

**How to use this checklist**

- Work **one phase at a time**. Do not start the next phase until every box in the current phase's **GATE** is ticked.
- After each phase I report: what was built, what was verified, what remains, and **any command you must run**.
- Tasks are labelled:
  - **[ME]** — I do this automatically; you only read the result.
  - **[YOU]** — you must click/create/copy something (credentials, accounts, or a copy-paste command).
  - **[VERIFY]** — a check that must pass before moving on.
- If a gate fails, we fix it and re-run the gate. We never "move on and hope".
- Nothing gets committed to git unless you ask.

**Legend of commands** (run in this project folder, in a terminal):

```
npm run dev            # start the app locally (http://localhost:3000)
npm run build          # production build (must pass with zero errors)
npm run lint           # code style checks
npm run typecheck      # TypeScript checks
npm run test:all       # the whole gate, in order (this is the one that matters)
npm run db:push        # apply database migrations (never paste SQL again)
npm run db:push -- --check   # report what the live database has, change nothing
npm run db:seed        # load LIS 815 content
npm run db:backup      # take a database backup
npm run db:restore -- --dry-run   # rehearse a restore, change nothing
npm run test:smoke -- --url https://your-site   # check the deployed site
```

---

## PHASE 0 — DISCOVERY & ARCHITECTURE ✅ (complete)

- [x] **[ME]** Read every Markdown specification in the project root
- [x] **[ME]** Extract text from all three PDFs (`docs/extracted/*.txt`) and read them fully
- [x] **[ME]** Record source inventory: 7 modules / 14 chapters / appendices A–C; 100-question objective paper with answer key; 7-question theory paper with model answers
- [x] **[ME]** Record discrepancy: exam filenames say `LIS_814`, content says `LIS 815` (course identity = LIS 815; documented, not silently changed)
- [x] **[ME]** Map all 100 objective questions → chapters (Appendix A of `BUILD_PLAN.md`)
- [x] **[ME]** Map all 7 theory questions → modules with sub-marks (Appendix B)
- [x] **[ME]** Identify academic-integrity risk: answers and questions share the same PDF → quarantine rules defined
- [x] **[ME]** Produce `BUILD_PLAN.md` (25 required sections)
- [x] **[ME]** Produce this checklist

**GATE — Phase 0**
- [x] **[VERIFY]** `BUILD_PLAN.md` contains all 25 requested sections
- [x] **[VERIFY]** All three PDFs read; no source contradiction introduced
- [ ] **[YOU]** Read `BUILD_PLAN.md` (especially §2, §7, §8, §25) and reply **"PROCEED TO PHASE 1"** — *or, if you already replied "start the building of the app", this gate is treated as passed.*

---

## PHASE 1 — SCAFFOLD & DESIGN SYSTEM ✅ (complete — 2 visual checks remain for you)

**Goal:** a running Next.js + TypeScript + Tailwind application with the visual foundation (tokens, layout shell, core components) and environment validation. No database yet.

- [x] **[YOU]** Install **Node.js LTS** if `node -v` fails *(already installed: Node v26.5.1)*
- [x] **[ME]** Create the Next.js project scaffold (App Router, TypeScript, Tailwind 4, ESLint, `@/*` alias, no `src/` folder — matching `PROJECT_STRUCTURE.md`)
- [x] **[ME]** Add folder skeleton: `components/ui`, `components/learner`, `components/staff`, `components/assessment`, `lib/supabase`, `lib/validation`, `lib/exam`, `lib/content`, `content/…`, `tests/`, `docs/extracted/`
- [x] **[ME]** Define design tokens: academic palette (navy/indigo + amber accent), type scale, spacing, status colours with text+icon pairing
- [x] **[ME]** Build core UI kit: `Button`/`ButtonLink`, `Card`, `Badge`, `Input`, `Textarea`, `Label`, `Progress`, `Skeleton`, `EmptyState`, `Callout`, `Dialog` (native `<dialog>`), `Tabs`, `Table`, `Toaster`
- [x] **[ME]** Build the app shell: skip-to-content link, focus-visible styles, `prefers-reduced-motion` support, print rules, responsive header with mobile menu
- [x] **[ME]** Build the public landing page (course intro, 7-module overview, learning outcomes, assessment guide with 70% rule and weights) — responsive classes at 360 / 768 / 1280
- [x] **[ME]** Error/empty/loading/not-found pages (`error.tsx`, `not-found.tsx`, `loading.tsx`)
- [x] **[ME]** `lib/env.ts` — Zod validation of environment variables with readable failure messages; `server-only` guard for secrets
- [x] **[ME]** Install minimal dependencies: `next`, `react`, `react-dom`, `tailwindcss`, `zod`, `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `react-markdown` + `remark-gfm`, `sonner`, `server-only`; dev: `typescript`, `eslint`, `@types/*`
- [x] **[ME]** `.env.example` (URL, anon key, service-role key marked SECRET) and `.gitignore` confirmed — no `.env.local` exists yet, no secrets in the repo
- [x] **[ME]** Write `DECISIONS.md` (D1–D13, plain-English) and update `CHANGELOG.md`
- [x] **[ME]** Security headers added (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)

**GATE — Phase 1**
- [x] **[VERIFY]** `npm run typecheck` passes ✅
- [x] **[VERIFY]** `npm run lint` passes ✅
- [x] **[VERIFY]** `npm run build` passes with zero errors ✅ (7 routes generated)
- [x] **[VERIFY]** Production server serves `/`, `/help`, `/login`, `/signup` with HTTP 200 and an unknown URL returns a proper 404 page ✅
- [ ] **[YOU]** Run `npm run dev`, open http://localhost:3000, and resize to 360px — confirm no horizontal scrolling and the mobile menu opens
- [ ] **[YOU]** Keyboard-only: Tab reaches every control; focus ring always visible
- [x] **[VERIFY]** No secret keys in the repo (only `.env.example` placeholders) ✅

---

## PHASE 2 — DATABASE, MIGRATIONS & RLS (built — blocked on your Supabase project)

**Goal:** the complete schema, all security rules, helper functions and settings — proven by tests before any UI depends on them.

- [ ] **[YOU]** Create a **free Supabase project** (supabase.com → "New project" → choose a password you keep safe)
- [ ] **[YOU]** Copy **Project URL** and **anon key** into `.env.local` (I give exact lines and exact places to paste)
- [ ] **[YOU]** Copy **service_role key** into `.env.local` under `SUPABASE_SERVICE_ROLE_KEY` (SECRET — never shown anywhere else)
- [ ] **[YOU]** Paste migrations `0001`–`0005` into the Supabase SQL Editor in order (I give exact steps)
- [x] **[ME]** Migration `0001_schema.sql`: **37 tables**, FKs, CHECKs, partial unique indexes, timestamps, `updated_at` triggers
- [x] **[ME]** Migration `0002_functions.sql`: helpers (`current_user_roles`, `is_admin`, `is_superadmin`, `has_permission`, `is_course_staff`, `is_enrolled`, `can_access_lesson`, `get_setting`, `course_of_*`) + `SECURITY DEFINER` RPCs: `enroll_self`, `record_reading_event`, `mark_lesson_complete`, `start_objective_attempt`, `submit_objective_attempt`, `create_theory_submission` (70% gate), `select_theory_questions` (exactly-5 rule), `submit_theory_submission`, `grade_theory_answer`, `release_theory_grade`, `recompute_enrollment_progress`, `certificate_eligible`, `issue_certificate`, `get_attempt_snapshot` / `get_attempt_results` / `get_theory_questions` (answers never leave the server unmarked)
- [x] **[ME]** Migration `0003_rls.sql`: RLS enabled on **every** table (37/37), default-deny, 76 policies, plus column-guard triggers (`attempt_answers.is_correct`, theory answer immutability, practical grading fields)
- [x] **[ME]** Migration `0004_seed_settings.sql`: roles (superadmin/admin/student), 9 permissions, 14 system settings (source weights 20/15/15/50 kept in content; LMS defaults flagged: theory unlock 70, theory pass 50, objective pass 50, reading 90%)
- [x] **[ME]** Migration `0005_search.sql`: `search_index` + 4 entity indexers + 5 sync triggers + `search_content()` RPC with access filtering + initial backfill
- [x] **[ME]** `scripts/validate-sql.mjs` + `npm run check:sql` — migrations proven against a throwaway Postgres (PGlite, no Docker/account): clean apply, **second run (idempotent)**, RLS coverage, seeded settings, signup trigger, invariant triggers ✅
- [x] **[ME]** Integration test suite `scripts/rls-tests.mjs` + `npm run test:rls`: students, non-enrolled student, instructor, forbidden reads/writes, gates and rules (runs once credentials exist)

**Database fixes found by `test:rls` on the live project (25 Sep)**

- [x] **[ME]** `search_content()` crashed on every call — `tsvector + tsvector` was removed in PostgreSQL 14; now `||` (`0005_search.sql`)
- [x] **[ME]** A student could never record an exam answer: the `attempt_answers` insert/update policies checked the chosen option with a subquery on `question_options`, which students may not read, so the check always failed. New `SECURITY DEFINER` helpers `option_belongs_to_question()` / `question_in_attempt()` (`0002_functions.sql`, `0003_rls.sql`)
- [x] **[ME]** `check:sql` now grants the API roles and runs the last block **as the `authenticated` role**, so both bugs are caught locally: student enrols, searches, records an answer, cannot set `is_correct`, cannot borrow another question's option, server marks 50% ✅
- [x] **[ME]** `check:sql` also applies `supabase/combined_migrations.sql` — the file you paste — to an empty database and then a second time, so the paste cannot fail ✅
- [x] **[YOU]** Re-paste `supabase/combined_migrations.sql` (Supabase → SQL Editor → New query → paste → Run). Every statement is `create or replace` / `drop … if exists`, so re-running is safe. Then: `npm run test:rls` ✅ **48 passed, 0 failed**

**GATE — Phase 2**
- [x] **[VERIFY]** Migrations apply cleanly from an empty database, twice in a row (idempotent) ✅ via `npm run check:sql`
- [x] **[VERIFY]** Student **cannot** read `question_options`, cannot write `lesson_progress`, cannot insert grades, cannot change own role ✅ written into `test:rls` (executes against your project)
- [x] **[VERIFY]** Instructor (non-admin, course-assigned) can author content; students cannot ✅ written into `test:rls`
- [x] **[VERIFY]** `npm run test:rls` green **against your Supabase project** ✅ **48 passed, 0 failed** (26 Sep, after the two database fixes below were re-applied)
- [x] **[VERIFY]** Public certificate verification returns only minimal fields ✅ built with Phase 10 and proven by `check:sql` ("a signed-out visitor verifies a certificate and sees only public fields")
- [ ] **[YOU]** Confirm in the Supabase Table Editor that you can see the tables (a quick confidence check)

---

## PHASE 3 — AUTHENTICATION & ROLES (built — account checks blocked on your Supabase project)

**Goal:** sign-up/sign-in/sign-out/reset working, profiles auto-created, three roles real, one-time superadmin claim.

- [x] **[ME]** Supabase SSR clients (`lib/supabase/server.ts`, `lib/supabase/client.ts`) + session refresh in **`proxy.ts`** (Next 16 renamed middleware → proxy; `middleware.ts` is deprecated)
- [x] **[ME]** Routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/confirm` (email confirmation)
- [x] **[ME]** Hand-built auth forms (design-system styles, Zod validation, clear error copy, role-aware redirect, friendly Supabase error messages, "Waiting for Supabase keys" state)
- [x] **[ME]** Database trigger: new `auth.users` row → `profiles` row + default `student` role ✅ proven by `npm run check:sql`
- [x] **[ME]** One-time `/setup/claim-superadmin` page backed by `claim_first_superadmin()` (advisory-locked, succeeds only if zero superadmins exist, audited) ✅ proven by `npm run check:sql`
- [x] **[ME]** Role-aware redirect after login (student → dashboard, admin → admin, superadmin → superadmin) via `lib/roles.ts` `homeForRole()`
- [x] **[ME]** Protected-route `proxy.ts` (session check + role check) + server-side re-validation on every page (`requireUser` / `requireRole` in `lib/auth.ts`)
- [x] **[ME]** App shell (`components/shell/app-shell.tsx`) + role layouts: `/dashboard`, `/admin`, `/superadmin` (each gated server-side)
- [x] **[ME]** Profile page (name, institution, bio, avatar upload to `avatars` bucket, password change)
- [x] **[ME]** Sign-out button on every app page
- [ ] **[YOU]** Create your own account in the running app
- [ ] **[YOU]** Click **"Claim Superadmin"** once (this is how you become the platform owner — no passwords in code)

**GATE — Phase 3**
- [ ] **[VERIFY]** New user can register, confirm email (or dev-mode auto-confirm), log out, log in *(needs your Supabase keys)*
- [ ] **[VERIFY]** Password reset email flow works *(needs your Supabase keys)*
- [ ] **[VERIFY]** Student visiting `/admin` or `/superadmin` is redirected and blocked server-side *(enforced in `proxy.ts` + `requireRole`; re-check with keys — without keys every route redirects to `/login` ✅)*
- [x] **[VERIFY]** Claiming superadmin works exactly once; second attempt reports "already initialised" ✅ via `npm run check:sql`
- [x] **[VERIFY]** Role change appears in `audit_logs` ✅ via `npm run check:sql`
- [x] **[VERIFY]** No session cookie → every protected route redirects to `/login` ✅ served and probed (`/dashboard`, `/admin`, `/superadmin`, `/profile`, `/setup/claim-superadmin` all land on `/login?next=…`)

---

## PHASE 4 — CONTENT PIPELINE & SEED (built — seed runs against your project once keys exist)

**Goal:** all supplied course material imported faithfully, with a validation report you can trust.

- [x] **[ME]** Content file format + parser (Markdown + YAML frontmatter) — `content/FORMAT.md` — and validator `scripts/validate-content.mjs` + `npm run check:content`
- [x] **[ME]** Author `content/core/` for **7 modules / 14 chapters**: objectives, all numbered sections, examples/formulas, review questions — transcribed verbatim from the ebook (section-fidelity check: 100%)
- [x] **[ME]** Author `content/orientation/`: about this guide, course orientation, study guide, assessment guide (incl. the 70% rule + flagged LMS defaults), how to use the reader, revision checklist
- [x] **[ME]** Author `content/assessments/objective.json`: all **100 MCQs + options + answer key** transcribed verbatim, each tagged to its chapter via BUILD_PLAN Appendix A (`source: supplied`)
- [x] **[ME]** Author `content/assessments/theory.json`: **7 theory questions** verbatim with sub-part marks (each summing to 20); model answers in a **staff-only** field + examiner caveat kept
- [x] **[ME]** Author knowledge-check questions (5 per chapter, `source: lms-authored`) derived from chapter review questions — 70 total
- [x] **[ME]** Import Appendix A → `practicals.json` (9 activities → `practical_activities`); Appendix B → `revision.json` (15 short + 10 essay + model outline → revision bank); Appendix C → `glossary.json` (**42 terms** — plan's 53 was wrong, source is authoritative, logged in ISSUES #1)
- [x] **[ME]** Import the Assessment & Examination Guide weights (20/15/15/50) into `system_settings` (4 new keys, source-attributed descriptions)
- [x] **[ME]** `npm run db:seed` (idempotent: find-by-natural-key, skip existing, `--force` to update; `--dry-run` and `--pglite` modes); fidelity report: `check:content` fuzzy-diffs all stems/options against `docs/extracted/*.txt`
- [x] **[ME]** `content/ISSUES.md` — every source ambiguity logged (18 rows; never silently fixed)
- [x] **[VERIFY]** Structure matches the source table of contents exactly (validator asserts all 14 titles + module mapping)

**GATE — Phase 4**
- [x] **[VERIFY]** Seed runs twice without duplicates ✅ `npm run db:seed -- --pglite` (run 1: +506, run 2: +0 inserted / 506 skipped, counts identical)
- [x] **[VERIFY]** 100 questions, 400 options, 100 correct answers, all keys within A–D ✅ `check:content`
- [x] **[VERIFY]** Fuzzy-diff report: 100/100 question stems **and** 400/400 option texts match the extracted PDF text ✅ `check:content`
- [x] **[VERIFY]** 7 theory questions; each sub-mark set sums to 20 ✅ `check:content`
- [x] **[VERIFY]** Glossary terms present = source count (**42**, not the 53 assumed — `ISSUES.md` #1) ✅ `check:content`
- [ ] **[YOU]** Spot-check 5 random questions and 2 theory questions against the PDFs and tick: "matches source"

---

## PHASE 5 — COURSE READER & PROGRESSION ENGINE ✅ (built & verified against your project)

**Goal:** the core learning experience with server-enforced sequential unlocking.

- [x] **[ME]** Course overview page: 7 modules → chapters → lessons with status icons (locked/available/in-progress/completed)
- [x] **[ME]** Lesson reader: sections rendered from Markdown (prose/example/formula/exercise styles), sticky progress rail, prev/next
- [x] **[ME]** Reading tracker (throttled events: scroll %, section coverage, time) → `record_reading()` RPC
- [x] **[ME]** `mark_lesson_complete()` RPC enforcing: enrolment + prerequisites + reading % + min time + required knowledge check
- [x] **[ME]** RLS on `lessons`/`lesson_sections` via `can_access_lesson()` — locked content invisible at the database level
- [x] **[ME]** Resume: reopen last lesson/last section anchor
- [x] **[ME]** Module + course roll-up (trigger-maintained `progress_pct`)
- [x] **[ME]** Learner dashboard v1: current position, progress ring, continue button, roadmap
- [x] **[ME]** Self-enrolment flow
- [x] **[ME]** `scripts/verify-progression.mjs` + `npm run test:progress` — 13 checks against your project: **13 passed, 0 failed**
- [x] **[ME]** `scripts/verify-pages.mjs` + `npm run test:pages` — 7 real-HTTP page checks against a production build (`npm run start`): **7 passed, 0 failed**. Signed-out requests to the reader, course and dashboard all bounce to `/login?next=…`; the public pages still answer 200; signed in, the dashboard, course outline and a completed lesson render; a locked lesson page ships no lesson content; an unknown lesson id shows the not-found page.
- [x] **[VERIFY]** Manual test: try to open lesson 2's URL before completing lesson 1 → blocked

**GATE — Phase 5**
- [x] **[VERIFY]** Reading under threshold → "Mark as completed" refused with a plain-English reason ✅ *"Read at least 90 percent of the lesson before marking it complete (currently 70 percent)"*
- [x] **[VERIFY]** Completion succeeds only when criteria met; the next lesson unlocks immediately ✅ the knowledge check after a reading lesson unlocks the moment the reading is done
- [x] **[VERIFY]** Direct URL/API request for a locked lesson returns **no content** ✅ `lesson_sections` returns 0 rows for a locked lesson
- [x] **[VERIFY]** Progress persists after logout/login and on another device ✅ re-checked through a brand-new signed-in client
- [x] **[VERIFY]** Tampering attempt (calling the completion RPC with unmet criteria) is refused and logged ✅ direct `lesson_progress` writes refused
- [ ] **[YOU]** Mobile: reader usable at 360px; tap targets ≥44px
- [x] **[ME]** Knowledge-check player — built with Phase 6 and wired into this reader: a `check` lesson runs its questions in place (`KnowledgeCheckPanel` in `/dashboard/lessons/[lessonId]`), the rail states the pass mark instead of a placeholder, and the chain still refuses to advance until the check is passed (proven by `test:progress`)

---

## PHASE 6 — KNOWLEDGE CHECKS, OBJECTIVE EXAM & 70% GATE ✅ (built & verified against your project)

**Goal:** the complete objective assessment engine.

- [x] **[ME]** Knowledge-check player (formative): runs inside its lesson, unlimited attempts, shows the right answer and explanation after each attempt, and gates lesson completion
- [x] **[ME]** Assessment centre page (`/dashboard/assessments`): status badges (Locked / In progress / Passed / Not passed / Time ran out), question count, pass mark, attempts left, full attempt history
- [x] **[ME]** `start_objective_attempt()` (eligibility + one-open-attempt resume + question/option order snapshot) — already existed, extended in `0007` with resume fields
- [x] **[ME]** `get_attempt_snapshot()` — the live paper with **no** `is_correct` and **no** explanations, plus every saved choice so a reload resumes
- [x] **[ME]** Exam runner UI: one question at a time, navigator grid, flag-for-review, server-authoritative timer chip, autosave with a saving indicator, unanswered warning, submit confirmation dialog
- [x] **[ME]** `save_answer()` — upsert, expiry-checked, never writes `is_correct`; expiry is **reported, not raised**, so the marking it performs survives
- [x] **[ME]** `submit_objective_attempt()` idempotent marking → score, percentage, passed (a second submit returns `already_submitted` and never changes the score)
- [x] **[ME]** Results screen (`/dashboard/assessments/results/[attemptId]`): score, pass/retry, expired banner, per-question review, explanations when the paper allows them
- [x] **[ME]** Attempt history with per-attempt status, score and date on the centre and in the card
- [x] **[ME]** `theory_eligibility()` gate + `TheoryGateCard`: 4-state badge (Open / Locked / Not started / Enrolment required) with a plain-English reason
- [x] **[ME]** `assessment_centre()` — one RPC for the whole centre page (question counts come from the server, because learners may not read `questions`)
- [x] **[ME]** `scripts/verify-assessment.mjs` + `npm run test:assessment` — 29 live checks: paper gating, question/option ownership, autosave, no `is_correct` leak, fail→refuse, pass→unlock, expiry, cross-learner privacy, 0/69/70/100 gate
- [x] **[ME]** `scripts/validate-sql.mjs` extended: 10 new PGlite checks for the Phase 6 RPCs, all run **as the `authenticated` role**

**Database fixes found by the Phase 6 tests**

- [x] **[ME]** `is_enrolled()` / `is_course_staff()` answer for the *caller*, so a teacher reading a learner's gate got the teacher's own answer. Added `is_enrolled_for()` / `is_course_staff_for()` and used them in `theory_eligibility()` and `assessment_centre()`
- [x] **[ME]** `save_answer()` raised on an expired attempt, which rolled back the marking it had just performed. It now returns `expired: true` and the score survives — proven by `check:sql` and `test:assessment`
- [x] **[ME]** A learner could rewrite their own closed attempt's score. New `assessment_attempts_write` policy allows updates only while `status = 'in_progress'`
- [x] **[ME]** The `lessons_incomplete` gate state was unreachable (lesson gating already happens in `start_objective_attempt`), so the gate is honestly 4-state as the plan specifies
- [x] **[ME]** `npm run db:push` applied the Phase 6 engine to your project (no pasting), and `npm run test:assessment` answers **29 ✅ / 0 ❌** against it

**GATE — Phase 6**
- [x] **[VERIFY]** All 100 questions served in order (or shuffled per setting) with A–D options ✅ `assessment_centre` counts 100, the snapshot serves the full `question_order`
- [x] **[VERIFY]** Timer expiry → answers rejected; attempt auto-submitted with what was saved ✅ `check:sql` + `test:assessment` ("a timed-out attempt is marked from its saved answers and says so")
- [x] **[VERIFY]** Double-click on Submit → one attempt, one score, no errors ✅ "submitting twice keeps one score and says so"
- [x] **[VERIFY]** Scores 0 / 69 / 70 / 100 all produce correct percentages and gate behaviour ✅ "the 70% gate: 0 and 69 stay locked, 70 and 100 unlock"
- [x] **[VERIFY]** Student cannot obtain `is_correct` through any endpoint ✅ live paper omits the field, `questions`/`question_options` are unreadable, `is_correct` writes refused
- [x] **[VERIFY]** Attempt history shows every attempt with dates and scores ✅ per-assessment list in the centre
- [ ] **[VERIFY]** Exam usable at 360px; autosave survives a mid-exam connection drop *(visual check for you + browser test)*

---

## PHASE 7 — THEORY EXAM & GRADING ✅ (built & verified against your project)

**Goal:** 5-of-7 selection, drafts, locked submission, human grading, release.

- [x] **[ME]** Theory landing: gate status + instructions (verbatim from source: 7 questions, answer 5, 20 marks each, 2 hours) — the assessment centre's `TheoryGateCard` now starts or resumes the paper and lists every paper already handed in
- [x] **[ME]** Selection UI: 7 question cards, counter "n of 5 selected", submit blocked until exactly 5
- [x] **[ME]** Answer editor: plain-text textarea, autosave drafts, word count, deadline banner; a question is only writable once its selection is confirmed on the server
- [x] **[ME]** `select_theory_questions()` / `save_theory_answer()` / `submit_theory_submission()` RPCs (all validations from `BUILD_PLAN.md` §8)
- [x] **[ME]** DB trigger enforcing exactly-5-on-submit, and the same rule at the RPC
- [x] **[ME]** Staff grading queue (`/admin/theory`) → grader view (`/admin/theory/[submissionId]`) showing the learner's 5 answers beside the **model answer + "indicative not exhaustive" caveat for staff only**, score 0–20 + feedback per question
- [x] **[ME]** Automatic total; status workflow `draft → submitted → under_review → graded → released`; claiming, overall comment, release and the learner's notification
- [x] **[ME]** Learner results view after release (`/dashboard/theory/results/[submissionId]`): per-question marks, feedback, total, and an honest "waiting to be marked" state before it
- [x] **[ME]** Re-grade creates audit entries (before/after)
- [x] **[ME]** `scripts/verify-theory.mjs` + `npm run test:theory` — 34 live checks, one paper walked the whole way
- [x] **[ME]** `scripts/validate-sql.mjs` extended: 20 new PGlite checks for the Phase 7 RPCs, run **as the `authenticated` role**

**Database fixes found while building Phase 7**

- [x] **[ME]** `grade_theory_answer()` would mark a paper still in draft, and a re-grade overwrote the score with nothing in the audit log. Both fixed, both tested
- [x] **[ME]** A learner could update their own draft `theory_submissions` row. RLS is per row, not per column, so that policy also let them move their own `expires_at` and set their own `total_score`. The write policies are **removed**: every theory write goes through a `SECURITY DEFINER` function, and a direct `UPDATE` now matches zero rows. Proven in `check:sql` and `test:theory`
- [x] **[ME]** One debounce timer was shared by all seven questions, so moving on from a question you had just written to cancelled the save of the one behind it. Now one timer per question, and leaving a question flushes it
- [x] **[ME]** `grade_theory_answer()` published a **running total** after the first answer was marked — on a row the learner can read. Migration `0010_released_marks_only.sql` writes `total_score` only once all five answers carry a mark, and the learner's own `theory_submissions` row cannot be selected while it holds a mark they have not been given. A released paper can no longer be re-marked, and releasing twice now says so instead of returning quietly
- [x] **[ME]** `npm run db:push` applied the Phase 7 engine to your project, and `npm run test:theory` answers **34 ✅ / 0 ❌** against it

**GATE — Phase 7**
- [x] **[VERIFY]** Selecting 4 or 6 → rejected at UI, RPC **and** DB trigger ✅ `check:sql` ("the trigger refuses a submitted paper with no answers", "theory selection must be exactly 5 questions") and `test:theory`
- [x] **[VERIFY]** Submitting with an empty selected answer → rejected ✅ "submitting with an empty answer is refused"
- [x] **[VERIFY]** After submit, learner cannot edit answers ✅ "a submitted paper can no longer be edited"
- [x] **[VERIFY]** Student role cannot insert/update `theory_grades` (tested) ✅ `check:sql` and `test:theory`
- [x] **[VERIFY]** Grading 18+17+20+19+20 → total 94 (arithmetic automatic); >20 per question impossible ✅ "18+17+20+19+20 totals 94"; `score numeric(5,2) check (score between 0 and 20)`
- [x] **[VERIFY]** Model answers invisible to student accounts ✅ "the learner workspace shows 7 questions and no model answers", "the released result shows marks and feedback, never a model answer"
- [x] **[VERIFY]** Learner below 70% objective never reaches any theory screen ✅ `test:theory` ("a learner with no objective pass cannot open the paper"); the RPC refuses, so no route can be reached
- [ ] **[VERIFY]** Exam usable at 360px; a mid-exam connection drop loses nothing *(visual check for you + browser test — the autosave retry path)*

---

## PHASE 8 — LEARNER TOOLING ✅ (built & verified against your project)

**Goal:** the day-to-day study tools.

- [x] **[ME]** Glossary: searchable, filter by module, A–Z, related terms, examples, `supplied`/`supplementary` badges
  - The supplied Appendix C data carries only term/definition/source/position, so the module filter, the related-terms block and the example block stay hidden until those fields are filled in. Everything else (search, A–Z letter filter, source badges, anchor links) works with what the study guide gives us.
- [x] **[ME]** Notes (per lesson/section) and bookmarks — own rows only
  - Written from the reader: highlight text or use the "Keep this lesson" card in the rail. `/dashboard/notes` and `/dashboard/bookmarks` hold everything the learner saved, with edit/delete.
- [x] **[ME]** Course search (PostgreSQL full-text): lessons, glossary, resources, announcements; highlighted snippets + module context
  - `search_content()` called server-side on `/dashboard/search?q=…`; matched words are marked, and a lesson the learner has not unlocked is never returned.
- [x] **[ME]** Announcements page + in-app notifications
  - Announcements come from `content/announcements/announcements.json` (published, dated, audience-scoped). Notifications live in the same page with an unread count on the dashboard and a "Study tools" menu in the nav.
- [x] **[ME]** Resources centre (student-visible files only; exam papers excluded)
  - Two learner resources (the full study-guide PDF and the help page) plus two staff-only examination papers. Files download through `/api/resources/<id>`, which answers 401 signed out and 404 when row-level security hides the row.
- [x] **[ME]** Revision centre: Appendix B short-answer self-test (reveal model answers on demand), essay practice list, final revision checklist with progress ticks
  - Served from `content/revision/revision.json` and `content/orientation/revision-checklist.md`, so it works on your project today. Progress ticks are saved in the browser (`localStorage`), which is labelled on the page — they are personal to the machine you tick them on.
- [x] **[ME]** Help/FAQ page
- [x] **[VERIFY]** Every personal feature is scoped to the signed-in user — `npm run test:tooling`

**GATE — Phase 8**
- [x] **[VERIFY]** Search returns sensible hits for e.g. "PRECIS", "recall", "scope note"
  - "PRECIS" → the glossary term; "recall" → glossary + lesson; "scope note" → the chapter that teaches it when asked as staff, and **nothing** when asked as a learner who has not unlocked chapter 5 (the test asserts both sides).
- [x] **[VERIFY]** Notes created by user A are invisible to user B (tested)
- [x] **[VERIFY]** Exam-paper resources do not appear for students — absent from the resources page and `/api/resources/<id>` answers 404 for a student.
- [x] **[VERIFY]** Empty states everywhere ("No notes yet — select text while reading…")

**GATE result:** `npm run test:tooling` **20 ✅ / 0 ❌**, `npm run test:pages` **17 ✅ / 0 ❌** (7 study-tool pages, dashboard links and 3 download checks), `lint` / `typecheck` / `build` clean.
Migration `0009_study_tooling.sql` (exam papers invisible even when a row says `visibility = 'students'`, and notifications that can only be marked read) is written, proven by `check:sql`, and **applied to your project** — `test:tooling` proves the tighter rule itself now, with no `NOTE` about a migration still to come.

---

## PHASE 9 — DASHBOARDS & ANALYTICS

**Goal:** the three role dashboards plus reporting.

- [x] **[ME]** Learner dashboard complete: progress, current module/lesson, completed/remaining, objective status+score, theory eligibility, theory result, certificate status, recent activity
- [x] **[ME]** Admin dashboard: learners, active learners, completion rate, attempts, average score, theory-eligible count, grading queue, completions, certificates, recent registrations, engagement
- [x] **[ME]** Superadmin dashboard: system stats, users/roles, settings, audit log viewer
- [x] **[ME]** Reports: CSV export (learners, attempts, grades); question analytics (difficulty index, option distribution) with plain-English help text
- [x] **[ME]** Content manager UI: create/edit/reorder/publish modules, chapters, lessons, sections
- [x] **[ME]** Question bank UI: list/edit questions and options; exam settings editor
- [x] **[VERIFY]** Dashboard numbers reconcile with hand-checked database counts

**GATE — Phase 9**
- [x] **[VERIFY]** With seeded demo data, every metric matches a manual query
- [x] **[VERIFY]** Empty/loading/error states on all dashboard panels
- [x] **[VERIFY]** Admin edits a lesson title in the UI → learner sees the change
- [x] **[VERIFY]** Non-superadmin cannot open system settings or audit log

---

## PHASE 10 — CERTIFICATES & VERIFICATION ✅ (built & verified 29 Sep)

**Goal:** configurable eligibility, issuance, printable certificate, public verification.

- [x] **[ME]** Eligibility engine (settings): required lessons complete + objective passed + theory graded/passed (configurable) + practicals if enabled — `certificate_eligible()` in `supabase/migrations/0013_certificate_publicity.sql`, proven by `check:sql` (practicals off by default, pass mark on the same 0–10 scale the grader uses)
- [x] **[ME]** Certificate issuance (staff/superadmin, or automatic on release) with unguessable certificate number + audit — `issue_certificate()` / `issue_certificate_core()`; `release_theory_grade()` issues it when `auto_issue_certificates` is on ✅ `check:sql` "releasing a marked paper issues the certificate automatically"
- [x] **[ME]** Printable certificate page (browser Print → PDF; no PDF library) with learner name, course, date, number, institution, QR — `components/…/certificate-view.tsx` + `@media print` rules in `globals.css`
- [x] **[ME]** QR generated in-browser (no external API) — `react-qr-code` inside `certificate-view.tsx`
- [x] **[ME]** Public `/verify/[number]` page: name, course, completion date, status only; rate-limited; audited — `get_public_certificate()` (30 lookups/minute per caller, audited, minimal fields) ✅ `check:sql` and the live production smoke test
- [x] **[ME]** Revoke flow (status + reason) reflected on verification — `revoke_certificate()` + `components/staff/certificate-revoke.tsx` + admin screen ✅ `check:sql` (refuses a missing reason, audits the change, shows the reason publicly)

**GATE — Phase 10**
- [ ] **[VERIFY]** Learner missing one requirement → no certificate, with a list of what's outstanding — *built in `/dashboard/certificate` (shows lessons, objective, theory and practicals outstanding); not yet covered by an automated check, so it stays open until you or a test looks at it*
- [x] **[VERIFY]** Verification with a random number returns "not found"; real number returns minimal data ✅ `check:sql` (two tests) and `npm run test:smoke` against the live site
- [x] **[VERIFY]** Revoked certificate reports as revoked ✅ `check:sql`, with the reason shown
- [x] **[VERIFY]** Verification endpoint rate-limited and audited ✅ `check:sql` ("stops after 30 lookups a minute per caller")
- [ ] **[VERIFY]** Certificate prints correctly on A4 from a phone and a desktop *(manual, one minute: open your certificate and use Print → Save as PDF)*

---

## PHASE 11 — PRACTICAL LABS & ENRICHMENT CONTENT (practicals built; enrichment not started)

**Goal:** Appendix A practical activities and the full, clearly-badged Supplementary Enrichment layer.

- [x] **[ME]** Practical activity pages (instructions, workspace, submission, rubric, model solution after release) — `/dashboard/practicals`, `/dashboard/practicals/[activityId]`; 9 activities seeded from Appendix A
- [x] **[ME]** Staff review/approve submissions (self-certify setting available) — `/admin/practicals` + `components/staff/practical-grader.tsx` (scores 0–10, feedback, release), which is also what the certificate pass mark is measured against
- [ ] **[ME]** Author the Supplementary Enrichment units (topics in `BUILD_PLAN.md` §16), each with objectives, sections, Nigerian/African examples where natural, self-check — **0 of 16 units written.** This is the largest remaining content job and it is content work, not code: say the word and it is next.
- [ ] **[ME]** Persistent "Supplementary Enrichment — not part of the supplied LIS 815 source" badge on units and in search results — *nothing to badge yet; the `source: supplementary` field and the search filter already exist in the data model*
- [x] **[VERIFY]** Enrichment never gates an examination or required completion (default settings) ✅ `check:sql` "practical activities do not gate a certificate by default", and no enrichment rows exist to gate anything

**GATE — Phase 11**
- [ ] **[VERIFY]** Every enrichment row has `source = supplementary`; no supplied row contains enrichment text (automated audit) — *the audit has nothing to read yet; it belongs with the enrichment work*
- [x] **[VERIFY]** Learner can complete the course without touching enrichment (default) ✅ true by construction today (no enrichment rows), and the settings that would add a requirement are off by default
- [ ] **[VERIFY]** At least one practical activity submittable and gradable end-to-end — *the screens and the grading path are built but no automated suite walks a submission from hand-in to grade; a manual pass or one scripted test would close this*

---

## PHASE 12 — ACCESSIBILITY, PERFORMANCE & POLISH (nothing verified yet)

**Goal:** WCAG 2.2 AA intent + low-bandwidth friendliness.

**Honest state (29 Sep):** `axe-core` is installed and `lint` / `typecheck` / `build` are clean, but there is no automated accessibility script, no recorded keyboard or screen-reader pass, no contrast audit and no Lighthouse run. Every box below stays open until one of those is done and the result recorded here.

- [ ] **[ME]** axe-core automated scan on key pages; fix all serious/critical issues
- [ ] **[ME]** Manual keyboard pass: enrol → read → complete → answer an exam question → submit (no mouse)
- [ ] **[ME]** Screen-reader spot-check: progress announcements, form errors, timer warnings, status changes
- [ ] **[ME]** Contrast audit of the palette; fix any <4.5:1 body text
- [ ] **[ME]** Performance budget: self-hosted fonts, `next/image`, lazy loading, JS weight per reading route < 100KB gzipped, FCP < 2s throttled 3G
- [ ] **[ME]** Reduced-motion honoured; no colour-only meaning; print styles for lessons + certificate
- [ ] **[ME]** Confirmation dialogs, toasts, retry states polished across the app

**GATE — Phase 12**
- [ ] **[VERIFY]** axe: 0 serious/critical violations on learner + admin + exam routes
- [ ] **[VERIFY]** Full core journey completed keyboard-only
- [ ] **[VERIFY]** Lighthouse performance ≥ 90 (landing, lesson) / ≥ 85 (exam) on mobile emulation
- [ ] **[VERIFY]** 360px: every core flow without horizontal scrolling

---

## PHASE 13 — FULL QA (automated gate green; acceptance journey open)

**Goal:** prove the acceptance criteria from `QA_ACCEPTANCE.md` and `BUILD_PLAN.md` §19.

**Honest state (29 Sep):** `npm run test:all` is green — content, migrations, RLS, progression, assessment, theory, tooling, dashboards — which covers most of the happy paths and many failure paths in the matrix. What it does not cover: the end-to-end acceptance journey (register → exams → grade → certificate → public verification) as one scripted run, the security sweep as its own pass, and the content proof-read. Those stay open.

- [ ] **[ME]** Complete the test matrix: happy paths + all failure paths (69%, skipping lessons, tampered completion, tampered score, unauthorised routes, expired session, direct API manipulation, 4-of-6 theory selection, duplicate submit)
- [ ] **[ME]** End-to-end acceptance journey automated (register → … → certificate)
- [ ] **[ME]** Security sweep: secrets scan, client-bundle check (no service-role key), RLS re-run, rate-limit trip test
- [ ] **[ME]** Content proof-read pass: theory model answers and objective key quarantined; fidelity report final; `ISSUES.md` presented to you
- [ ] **[YOU]** Review `content/ISSUES.md` and decide each logged source ambiguity
- [ ] **[YOU]** Personal UAT: walk the whole course as a student on your phone

**GATE — Phase 13**
- [ ] **[VERIFY]** `npm run test:all` green (unit + RLS integration + E2E)
- [ ] **[VERIFY]** Every checklist item in `BUILD_PLAN.md` §25 ticked, or explicitly deferred with your agreement
- [ ] **[VERIFY]** No dead links / placeholder buttons in production views
- [ ] **[YOU]** Signs off: "ACCEPTED"

---

## PHASE 14 — DEPLOYMENT & DOCUMENTATION

**Goal:** live on a real URL, documented for whoever maintains it next.

- [x] **[YOU]** Free GitHub account (if you don't have one) — I generate every command ✅ the repository exists: `github.com/scholarsuite25-netizen/indexingandabstracting`
- [x] **[YOU]** Push repo to GitHub (copy-paste block provided) ✅ `main` is in step with `origin/main` (today's work is still uncommitted — say the word and I will commit it)
- [x] **[YOU]** Free Vercel account → import repo → set environment variables (exact names/values given; service-role key pasted into Vercel only) ✅ the site answers at `https://indexingandabstracting.vercel.app` and the signed-in journey runs against it
- [x] **[YOU]** In Supabase: **Auth → URL Configuration** → add the Vercel domain (clicks given) ✅ sign-in works on the live site, which only happens when this is set
- [x] **[ME]** `START_HERE.md` — the full non-coder runbook (13 numbered steps, exact clicks, exact credentials, where each one goes) ✅ written 29 Sep
- [x] **[ME]** `COSTS.md`, `SECURITY.md`, `RLS.md`, `DEPLOYMENT.md`, `DATABASE.md`, `ASSESSMENT_ENGINE.md`, `CONTENT_MODEL.md`, `TEST_PLAN.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `README.md`, `CHANGELOG.md` final ✅ all twelve exist (seven written 29 Sep; the figures they could not verify from the repo are marked "to confirm" rather than guessed)
- [x] **[ME]** CI: lint + typecheck + tests + build on every push ✅ `.github/workflows/ci.yml`: `quality` runs lint, typecheck, `check:content`, `check:sql` and `npm run build` on every push; `live` adds `db:push -- --check` and `npm run test:all` when the three Supabase values are set as repository secrets
- [x] **[ME]** `scripts/db-backup` + documented restore drill ✅ `npm run db:backup` wrote 39 tables / 2045 rows to `backups/`; `npm run db:restore -- --dry-run` rehearsed the full restore inside a transaction and rolled it back (every row count matched). `DATABASE.md` documents both.
- [x] **[ME]** Production smoke test (full journey on the live URL) ✅ `npm run test:smoke -- --url https://indexingandabstracting.vercel.app` → **5 passed, 0 failed**, including the 17-check signed-in journey

**GATE — Final**
- [x] **[VERIFY]** Production URL serves the app over HTTPS ✅ the smoke test fetched every page over `https://`
- [ ] **[VERIFY]** Full journey completed on production: student → exams → grade → certificate → public verification — *the reading, study-tool and download half of the journey is scripted and green on production; the examination → grading → certificate half has only been proven against the live database, not by one walk-through on the live site. That walk-through is the last big check.*
- [x] **[VERIFY]** `npm run test:all` green against production-equivalent config ✅ all eight suites green on 29 Sep against your live Supabase project (after the anon key was replaced and migration 0013 applied)
- [x] **[VERIFY]** No secrets in git history; `.env.example` complete ✅ no `.env*` file was ever committed, no JWT or service key appears in any commit, and `.env.example` carries all 17 names
- [ ] **[VERIFY]** Backups scheduled; a restore has been drilled once — *drilled once ✅ (29 Sep, dry run). "Scheduled" is open: nothing takes a backup automatically yet, so it is a habit until you want a weekly `npm run db:backup` in CI or a reminder.*
- [ ] **[YOU]** Final acceptance: **"DELIVERED"**

---

## CURRENT STATUS

| Phase | State |
|---|---|
| 0 — Discovery & architecture | ✅ complete |
| 1 — Scaffold & design system | ✅ built & verified (2 visual checks for you) |
| 2 — Database, migrations & RLS | ✅ built & verified — `npm run check:sql` green, `npm run test:rls` against your project **48 ✅ / 0 ❌** |
| 3 — Authentication & roles | ✅ built & verified (account checks need your keys) |
| 4 — Content pipeline & seed | ✅ built & verified (`check:content` 31 ✅, seed idempotent) |
| 5 — Course reader & progression | ✅ built & verified — `npm run test:progress` 13 ✅ / 0 ❌, `npm run test:pages` 17 ✅ / 0 ❌ (1 visual check for you) |
| 6 — Knowledge checks, objective exam, 70% gate | ✅ built & verified — `npm run db:push` applied, `npm run test:assessment` **29 ✅ / 0 ❌** |
| 7 — Theory exam & grading | ✅ built & verified — `npm run db:push` applied, `npm run test:theory` **34 ✅ / 0 ❌**, `check:sql` green (10 migrations) |
| 8 — Learner tooling | ✅ built & verified — `npm run test:tooling` 20 ✅ / 0 ❌, `npm run test:pages` 17 ✅ / 0 ❌, `lint` / `typecheck` / `build` clean |
| 9 — Dashboards & Analytics | ✅ built & verified — `npm run test:dashboards` green 29 Sep (hand-checked counts matched; the `question_analytics` RPC bug it exposed is fixed in `0011_reporting.sql`) |
| 10 — Certificates & Verification | ✅ built & verified 29 Sep — eligibility, issuance on release, revoke, rate-limited public verify all proven by `check:sql`; production smoke green (2 gate checks still open: outstanding-requirements UI, A4 print) |
| 11 — Practical Labs & Enrichment | ⚠️ practicals built (pages, workspace, grading); **Supplementary Enrichment not started (0 of 16 units)** |
| 12 — Accessibility & Polish | ❌ not verified — `lint` / `typecheck` / `build` clean and axe installed, but no axe run, keyboard pass, contrast audit or Lighthouse score has been recorded |
| 13 — Full QA | ⚠️ automated gate green 29 Sep (all eight suites); the end-to-end acceptance journey and the security sweep are still open |
| 14 — Deployment | ⚠️ live at `https://indexingandabstracting.vercel.app` with docs, CI, backup + restore drill and a green production smoke test; the exams-to-certificate half of the production journey and your final acceptance remain |

**GATE — re-run 29 Sep:** `npm run test:all` **green**: `check:content` 31 ✅, `check:sql` all migrations + every certificate check ✅, `test:rls` 48 ✅, `test:progress` 13 ✅, `test:assessment` 29 ✅, `test:theory` 34 ✅, `test:tooling` 20 ✅, `test:dashboards` 1 ✅ — 0 failures. `lint` 0 errors, `typecheck` clean, `build` clean. `npm run test:smoke` against the live URL: **5 ✅ / 0 ❌** (17-check signed-in journey included). The runner retries a suite only when it fails on the connection itself (`fetch failed`), never a suite that failed on its own assertions.

**What went wrong today, and what fixed it (29 Sep):** `.env.local` had been overwritten by an unrelated script, so the Supabase keys were gone. The URL and anon key were recovered from the local build cache, the service-role key and `DATABASE_URL` came back from the dashboard, and the recovered anon key turned out to be signed with a superseded secret (`Invalid API key`) — replaced with the one the project still accepts. Migration `0013_certificate_publicity.sql` had been written but never applied, so `npm run db:push` sent it. `question_analytics` was fixed (two aggregate ORDER BYs referenced aliases out of scope), and `scripts/db-backup.mjs` needed two fixes found by actually running the backup and the restore drill.

**Next action (you):** three short ones, then the rest is mine:
1. Walk the site as a student on `npm run dev` → <http://localhost:3000>: read a lesson, try to mark it complete before 90%, resize to 360px.
2. On the live site, do the half of the journey no script covers yet: objective paper at 70%+ → theory exam (5 of 7) → hand in → mark it at `/admin/theory` → release → open `/dashboard/certificate` → copy the number → check it at `https://indexingandabstracting.vercel.app/verify/<number>`.
3. Decide on the Supplementary Enrichment units (16 of them, content work) — say **"write the enrichment units"** and that becomes the next block.

**Then me:** the Phase 12 accessibility/performance passes, the scripted acceptance journey, and a scheduled backup — in whichever order you point me at.
