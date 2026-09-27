# BUILD PLAN — LIS 815 INDEXING AND ABSTRACTING LMS

**Status:** Discovery & Architecture Phase — COMPLETE (planning document, no application code written yet)
**Date:** 2026-09-25
**Prepared by:** Lead Software Architect (acting also as Full-Stack Engineer, UX/UI Designer, Database Architect, QA Engineer, DevOps Engineer and Educational Technology Specialist)
**Audience:** The course owner (a non-coder) and any future developer who inherits this project.

> **How to read this document**
> Sections 1–25 follow the structure you requested. Plain-English explanations are written for you as a non-coder; technical detail is written for whoever implements or reviews the system. Nothing in this plan contradicts the supplied course materials. Every fact drawn from the supplied PDFs is marked as **source**; everything else is either an engineering decision (**decision**) or clearly labelled **Supplementary Enrichment**.

---

## 1. Project overview

### 1.1 What we are building

A complete, production-ready Learning Management System (LMS) for the postgraduate course **LIS 815 — Indexing and Abstracting**: seven modules, fourteen chapters, a 100-question objective examination, a seven-question theory examination (answer five), practical exercises, a glossary, progress tracking, grading, certificates and reporting — usable on a phone, a modest laptop and a slow connection.

### 1.2 What this is *not*

It is not a demo, not a template, and not a "click-through slideshow". Completion, scoring, eligibility and grading are enforced **in the database**, so a learner cannot unlock an examination by editing a browser flag or by calling an API directly.

### 1.3 Technology (fixed for this project)

| Layer | Choice | Plain-English reason |
|---|---|---|
| Frontend + backend logic | **Next.js (App Router) + TypeScript** | One codebase for pages and server logic; huge free community support; deploys free on Vercel. |
| Styling | **Tailwind CSS + shadcn/ui component pattern** | Pre-built, accessible, copy-in components you own outright — no monthly vendor fee, no lock-in. |
| Database | **Supabase PostgreSQL** | A free, hosted, industry-standard database with built-in authentication, file storage and row-level security. |
| Security | **Row Level Security (RLS) + database functions (RPCs)** | Rules live inside the database itself, so they hold even if the website code has a bug. |
| Hosting | **Vercel (free Hobby tier)** | Zero-configuration hosting for Next.js with free HTTPS. |
| Source control | **GitHub (free)** | Version history, rollback and the link to Vercel. |
| Paid services required | **None** | Every core feature works on free tiers. AI APIs, if ever added, are optional and off by default. |

### 1.4 Governing principles (in priority order)

1. **Accuracy** — the supplied PDFs are the authoritative academic source; nothing is silently rewritten.
2. **Security** — server/database enforcement for every sensitive rule.
3. **Simplicity** — the simplest secure design that meets the requirement; minimal dependencies.
4. **Usability** — a non-technical administrator can manage content; a learner on a phone can study and sit exams.
5. **Accessibility** — WCAG 2.2 AA intent: keyboard, contrast, focus, screen readers.
6. **Maintainability** — strict TypeScript, clear folders, documentation, tests.
7. **Zero/low cost** — free tiers first; documented costs only where unavoidable.
8. **Academic quality** — supplementary material is always labelled as such.

### 1.5 The non-coder contract

You will never be asked to hand-write code. At each phase you receive: (a) exactly what I will build, (b) the few clicks/credentials **you** must supply (mainly Supabase and GitHub), (c) copy-and-paste commands where a terminal is needed, and (d) a verification gate that must pass before the next phase starts.

---

## 2. Understanding of the supplied source materials

### 2.1 Inventory (all three PDFs read in full during discovery)

| File in `docs/` | Pages | Extracted text | Role |
|---|---:|---:|---|
| `Indexing_and_Abstracting_Complete_Ebook.pdf` | 38 | 82,682 characters | Authoritative course text (study guide, 2nd edition, expanded 2026) |
| `LIS_814_Objective_Examination.pdf` | 12 | 24,458 characters | Authoritative objective examination (100 MCQs + answer key) |
| `LIS_814_Theory_Examination.pdf` | 5 | 14,555 characters | Authoritative theory examination (7 questions + model answers) |

Text was extracted to `docs/extracted/*.txt` during discovery so the content pipeline can work from machine-readable text rather than re-parsing PDFs. The original PDFs remain untouched.

### 2.2 Discrepancy found in the source package (documented, not silently fixed)

- The two examination **filenames** say `LIS_814`, but the **content** inside both PDFs is headed **"LIS 815 • INDEXING AND ABSTRACTING"**. `README.md` also refers to them as LIS 815 files.
- **Rule applied:** course identity = **LIS 815** everywhere in the LMS. File names are treated as a packaging typo and recorded here. The examination content itself is used verbatim.

### 2.3 What the ebook contains (structure preserved exactly)

- Front matter: copyright/use note, preface (plain-language, postgraduate beginners, "understanding before memorisation").
- **7 modules / 14 chapters** exactly as specified in your brief.
- Teaching pattern inside every chapter: learning objectives → numbered plain-language sections (e.g. `1.1`–`1.8`) → boxed EXAMPLE/WORKED EXAMPLE/FORMULA blocks → Review Questions (4–6 per chapter, 67 total).
- **Appendix A — Practical Exercises:** thesaurus construction, indexing practice (3 titles), PRECIS preparation, KWIC/KWOC practice, evaluation calculation, abstracting practice (60–80 / 100–150 words), full abstracting exercise (8 steps).
- **Appendix B — Revision Questions and Model Answers:** 15 short-answer questions with model answers, 10 essay questions, plus a model comparison outline (pre/post-coordinate).
- **Appendix C — Glossary of Key Terms:** 53 terms with definitions (Abstract … USE).
- **Assessment and Examination Guide:** Indexing Practicum 20%, Abstracting Portfolio 15%, Mid-Term Assessment 15%, Final Examination 50% — with preparation guidance.
- **Final Revision Checklist:** 12 checklist bullets.

### 2.4 What the objective examination contains

- Header: **LIS 815: Indexing and Abstracting — Objective Examination**, **Time Allowed: 1 Hour 30 Minutes**.
- Instructions: 100 questions, answer ALL, four options A–D, one correct option, 1 mark each → 100 marks total.
- Questions 1–100 present, options A–D present for every question (verified during extraction).
- **Complete answer key provided** (1.B, 2.D, … 100.C).
- Coverage is almost perfectly aligned to the chapters — see **Appendix A** for the full question-to-chapter map. Roughly **seven questions per chapter**.

### 2.5 What the theory examination contains

- Header: **LIS 815: Indexing and Abstracting — Theory Examination**, **Time Allowed: 2 Hours**.
- Instructions: **SEVEN** questions, answer any **FIVE**, all questions equal at **20 marks each** → 100 marks.
- Each question is explicitly tagged to a module: Q1→Module 1, Q2→Module 2, Q3→Module 3, Q4→Module 4, Q5→Module 5, Q6→Module 6, Q7→Module 7 (a clean 1:1 mapping).
- Sub-part mark splits total 20 in every question (e.g. Q1 = 6+6+8; Q5 = 5+4+11).
- **Model answers supplied for all 7 questions**, with the printed caveat: *"Answers are indicative rather than exhaustive; award marks for any well-reasoned equivalent response."* This caveat becomes grading guidance in the LMS.

### 2.6 Academic-integrity consequences of the source layout (critical finding)

The supplied PDFs place **questions and answers in the same file**:

1. The objective answer key is on page 12 of the question paper.
2. The theory model answers are on pages 3–5 of the question paper.

**Rules derived from this (non-negotiable):**

- The examination PDFs must **not** be offered as ordinary student resources. They are stored as **staff-only resources** (or released only after an attempt, per setting).
- Correct answers live in a column that students can never read (no RLS path exposes it; the exam paper is served by a database function that strips the answer column).
- Model answers are stored in **staff-only** tables/columns and are shown to students only after a submission has been graded and released (configurable).
- Objective questions themselves are never sent to the browser before an attempt starts, and are only ever sent for the specific attempt in progress.

### 2.7 What the source does *not* specify (must be configured, never invented as "source")

| Gap | LMS treatment |
|---|---|
| Theory pass mark | Admin-configurable setting (initial default 50/100, labelled *"LMS default — not specified by the source"*). |
| Certificate rules | Admin-configurable conditions (see §22.1). |
| Objective retake limit | Admin-configurable (initial default: unlimited attempts, best score counts). |
| Whether all lessons must be finished before the objective exam | Admin-configurable, default **ON** (matches your brief's progression intent). |
| Reading threshold | Admin-configurable 90–100%, default **90%** (as instructed by the master prompt). |
| Enrichment topics | Labelled **Supplementary Enrichment**, never examinable. |

### 2.8 Source-fidelity rules for the build

1. Supplied wording of questions, options, answers, definitions and model answers is transcribed **verbatim** into the database seed.
2. Any typo or ambiguity in the source is **preserved and flagged** in a content-issues log (`content/ISSUES.md`) for the lecturer to decide — never silently corrected.
3. LMS-authored formative items (chapter knowledge checks) are marked **`source: lms-authored`** and are visually distinct from the authoritative examination.
4. Enrichment is marked **`source: supplementary`** with a persistent badge.

---

## 3. Functional requirements

IDs are used later by the test plan and the definition of done.

### Course & content
- **FR-01** Present the course as 7 modules / 14 chapters (structure immutable).
- **FR-02** Support supporting areas: orientation, learning objectives, study guide, glossary, practical exercises, revision centre, results, resources, search, notes/bookmarks, announcements, help.
- **FR-03** Render lessons as ordered sections (prose, examples, formulas, exercises) from Markdown.
- **FR-04** Admin can create/edit/reorder/publish/archive modules, chapters, lessons and sections without touching code.
- **FR-05** Admin can upload/attach resources (PDF, link) to course/module/chapter/lesson.
- **FR-06** Search across lessons, glossary, resources and announcements (server-side, free).

### Learning progression (enforced server-side)
- **FR-07** Lesson states: `locked | available | in_progress | completed` (locked/available derived; in_progress/completed stored).
- **FR-08** Track reading: scroll-derived percentage + section coverage + time-on-task, throttled and stored as events, aggregated server-side.
- **FR-09** "Mark as completed" only succeeds when reading threshold, minimum time and any required knowledge check are satisfied — validated in a database function.
- **FR-10** Next lesson/chapter/module unlocks only after prerequisite completion is recorded in the database; URL manipulation cannot bypass it (RLS).
- **FR-11** Resume: learner returns to last lesson and last section position.
- **FR-12** Module completion and course completion roll up automatically.
- **FR-13** Prerequisite graph stored explicitly (supports future branching), with linear defaults generated from position.

### Knowledge checks (formative)
- **FR-14** Per-chapter knowledge checks (5 MCQs, unlimited attempts, default pass 70%, no effect on final grade) may be required by a lesson before it can be completed.
- **FR-15** Knowledge-check questions are LMS-authored from supplied text and labelled as such.

### Objective examination
- **FR-16** Question bank with 100 MCQs × 4 options, one correct answer, 1 mark each, chapter/module tagging.
- **FR-17** Timed attempt (default 90 minutes, configurable), server-side expiry.
- **FR-18** Autosave answers; resume policy configurable; unanswered-question warnings; question navigator.
- **FR-19** Automatic marking on submit; score, percentage, pass/fail stored.
- **FR-20** Idempotent submission (duplicate submits cannot double-mark or corrupt).
- **FR-21** Attempt history with per-question review (per setting), explanations optional.
- **FR-22** Configurable max attempts, question/option randomisation (answer correctness preserved).
- **FR-23** Eligibility gate to theory examination at ≥70%, enforced in database.
- **FR-24** Admin reporting: pass rate, averages, per-question difficulty and option distribution.

### Theory examination
- **FR-25** Show all 7 questions; learner must select **exactly 5** (fewer/more rejected server-side).
- **FR-26** Free-text answer editor (plain text/Markdown) with draft autosave and word count.
- **FR-27** Final submission locks the attempt; drafts preserved until then.
- **FR-28** Stored answers: only the 5 selected; the other 2 preserved as "not selected".
- **FR-29** Grading workflow: `draft → submitted → under_review → graded → released`.
- **FR-30** Per-question marks 0–20, automatic total, per-question feedback, overall feedback, grader identity + timestamp.
- **FR-31** Human grading only. Any AI assistance is an optional, off-by-default assistant; the grader always commits the mark.

### Outcomes
- **FR-32** Results centre: objective score/status, theory result, attempt history, feedback.
- **FR-33** Certificates: configurable eligibility, unique certificate number, printable certificate, public verification page revealing minimal data, QR code.
- **FR-34** Progress dashboard (learner) with percentages, current position, exam status, certificate status, recent activity.
- **FR-35** Admin dashboard (learners, progress, attempts, grading queue, registrations, engagement) and Superadmin dashboard (all of the above + users, roles, settings, audit logs).

### Platform
- **FR-36** Three roles: superadmin, admin/instructor, student (+ public certificate verification).
- **FR-37** Student notes and bookmarks (own rows only).
- **FR-38** Announcements (course-level) and notifications (user-level, in-app).
- **FR-39** Audit log for all sensitive actions (append-only).
- **FR-40** Responsive, keyboard-accessible, low-bandwidth-friendly UI with loading/empty/error/confirmation/toast states.

---

## 4. User roles

### 4.1 Role model

| Capability | Student | Admin/Instructor | Superadmin | Public (signed out) |
|---|:--:|:--:|:--:|:--:|
| Register / sign in / reset password | ✔ | ✔ | ✔ | — |
| Study enrolled published lessons | ✔ | ✔ | ✔ | — |
| Own progress, notes, bookmarks, results | ✔ | ✔ | ✔ | — |
| Sit objective exam when eligible | ✔ | — | — | — |
| Sit theory exam when ≥70% objective | ✔ | — | — | — |
| Manage assigned course content | — | ✔ | ✔ | — |
| Manage questions / exams / resources | — | ✔ (assigned) | ✔ | — |
| Grade theory answers, give feedback | — | ✔ (assigned) | ✔ | — |
| Review learner progress, export reports | — | ✔ (assigned) | ✔ | — |
| Manage all users, roles, courses | — | — | ✔ | — |
| System settings, audit logs, analytics | — | — | ✔ | — |
| Issue/revoke certificates | — | ✔ (assigned) | ✔ | — |
| Verify a certificate by number | — | — | — | ✔ (minimal data only) |

*Admin/Instructor scope is bounded by a `course_staff` assignment; Superadmin bypasses scope. "Admin manages only assigned courses" is a hard rule, enforced by RLS.*

### 4.2 Permission catalogue (seeded, data-driven)

`permission` codes (kept small and coarse — fine-grained ABAC is deliberately avoided):
`content.manage`, `assessment.manage`, `learner.review`, `theory.grade`, `certificate.issue`, `announcement.manage`, `report.view`, `user.manage`, `role.manage`, `settings.manage`, `audit.view`.

Roles map to permissions via `role_permissions`. Future custom roles can be added without code changes.

### 4.3 The one rule that outranks everything

**No one — including a superadmin's browser — can edit their own role, scores, completion flags, grades or certificates directly.** All such changes flow through database functions that check the caller's role inside the database.

---

## 5. LMS learning flow

### 5.1 The learner journey

1. **Register** (email + password) → profile auto-created by database trigger.
2. **Landing/course page** → "Enrol in LIS 815" (one-click self-enrolment if the course is open, or admin pre-enrolment).
3. **Orientation area** ("Start Here", non-credit, outside the 7 modules): course orientation, learning objectives, study guide, how assessment works (including the 70% rule), how to use the reader.
4. **Dashboard** shows: current module, current lesson, % complete, next milestone, exam status.
5. **Open Module 1 → Chapter 1 → Lesson 1** (core reading).
   - The reader loads sections, tracks scroll/section coverage/time (throttled events), shows a live reading-progress bar.
   - When reading threshold (≥90% default) + minimum time are met, **Mark as completed** becomes enabled.
   - Clicking it calls `mark_lesson_complete()` **in the database**, which re-validates everything and only then writes `completed`.
6. **Next lesson unlocks** (server-side). The reader offers "Continue".
7. **Knowledge-check lesson** (5 formative MCQs): must reach the configured score before that lesson completes.
8. **Optional practical lesson** (where mapped from Appendix A): learner submits work; completion is teacher-approved or self-certified per lesson setting.
9. Repeat through 14 chapters; **module completion** when all required lessons complete; **course learning completion** when all required lessons complete.
10. **Revision centre** (Appendix B self-test) → then the **Objective Examination**.
11. **Objective Examination** (100 MCQs, 90 min) → auto-marked → result + targeted revision guidance.
12. **≥70% → Theory Examination unlocks**; below 70% → "Needs Retry" with chapter-level gap analysis.
13. **Theory Examination** (7 questions → select exactly 5 → write → submit).
14. **Lecturer grades** (0–20 per question, feedback) → total → **released**.
15. **Results centre** shows everything; **certificate** issued if all configured conditions hold.
16. Throughout: notes, bookmarks, glossary, search, announcements, help.

### 5.2 Progression engine (the core business rule)

**State model per lesson (per learner):**

```
locked ──(all prerequisites completed)──▶ available ──(opened)──▶ in_progress
   ▲                                                                │
   └──────────────(admin unpublish/lock)────────── completed ◀──────┘
                     (only via mark_lesson_complete())
```

- `locked` / `available` are **derived**, never trusted from the client.
- `in_progress` / `completed` are **stored** in `lesson_progress`.

**Completion criteria (all stored per lesson, admin-editable):**

| Criterion | Column | Default |
|---|---|---|
| Required reading percentage | `required_reading_pct` | 90 |
| Minimum seconds on content (advisory, never sufficient alone) | `min_seconds` | derived from estimated reading time |
| Required knowledge check | `required_assessment_id` (nullable) | set for knowledge-check lessons |
| Minimum check score | `required_assessment_min_score` | 70 |
| Staff approval (practical lessons) | `requires_approval` | false |

**Where it is enforced (three independent layers):**

1. **Database function** `mark_lesson_complete(lesson_id)` — `SECURITY DEFINER`; re-reads reading aggregates, prerequisite rows, knowledge-check results; refuses with a precise error code if any condition fails; writes the completion + audit row in one transaction.
2. **RLS on content tables** — a learner's `SELECT` on `lessons` / `lesson_sections` requires `can_access_lesson(lesson)` to return true (i.e. every prerequisite completed). **A locked lesson returns no content at all, even if the learner pastes the URL or calls the API directly.**
3. **UI** — buttons/progress are only a *reflection* of server state; they can hide, never grant.

**Anti-tamper specifics:**
- Students have **no `INSERT`/`UPDATE`/`DELETE` privilege** on `lesson_progress`; writes happen only through the two functions (`record_reading()`, `mark_lesson_complete()`).
- Reading events are append-only and rate-limited; the aggregate used for completion is `MAX(pct)` per section plus distinct-section coverage, so a single forged "100%" event from a hostile client would still be caught by section-coverage checks and flagged in audit if anomalous.
- Completion is idempotent (second call returns the existing completion, does not double-write).

**Module/course roll-up:** maintained by triggers on `lesson_progress` (`enrollments.completed_required_lessons`, `progress_pct`), so dashboards never compute by scanning thousands of rows.

---

## 6. Examination flow

### 6.1 Objective examination (authoritative bank: supplied 100-question paper)

```
Eligibility check ─▶ Start attempt ─▶ Answer + autosave ─▶ Submit ─▶ Auto-mark ─▶ Result
 (DB function)        (DB function)    (DB function)        (DB fn,      (same fn)     (read own)
                                          ▲                 idempotent)
                                          └── timer expiry (server clock) ──▶ auto-submit
```

1. **Eligibility** `start_objective_attempt()` verifies: enrolment active; all required lessons complete (if the setting is on); attempts remaining; no attempt already `in_progress` (partial unique index enforces one open attempt).
2. **Start** creates the attempt: `attempt_no`, `started_at`, `expires_at = started_at + duration`, and a **snapshot of question order** (and option order if randomisation is on) so later settings changes cannot corrupt a running attempt. Partial unique index: one `in_progress` attempt per (user, assessment).
3. **Fetch paper** `get_exam_paper(attempt_id)` returns questions + shuffled options **with no `is_correct` column and no explanation** — only for the caller's own in-progress, unexpired attempt.
4. **Answer** `save_answer(attempt_id, question_id, option_id)` upserts (`UNIQUE(attempt_id, question_id)` prevents duplicates), validates the attempt belongs to the caller, is `in_progress`, and is unexpired. This is the autosave.
5. **Timer** is displayed client-side (countdown, warns at 5/1 minutes) but the **server clock is authoritative**; after `expires_at` every `save_answer` fails and the attempt can only be submitted.
6. **Submit** `submit_attempt(attempt_id)`:
   - Runs `UPDATE ... WHERE status = 'in_progress'` inside the function — if zero rows, it returns the *already-computed* result instead of re-marking (**duplicate-submit protection**).
   - Marks each stored answer against `question_options.is_correct` (function has definer rights; the student never had read access to that column).
   - Computes `score`, `percentage = round(score/total*100, 2)`, `passed = percentage >= pass_mark`.
   - Writes audit row; returns the result payload.
7. **Result**: score, percentage, Pass/Needs-retry, per-question review (own selections; correct answers + explanations revealed only if `show_correct_answers` setting allows), and **targeted revision guidance** — wrong answers are grouped by chapter so the learner is told *"Revise Chapter 5: Thesaurus Structure — 4 incorrect"*.
8. **Attempt history**: every attempt with date, score, status; best score drives eligibility (setting: `best_attempt_counts`, default true).
9. **Admin analytics**: pass rate, mean/median, per-question difficulty (`p = correct/n`), option-selection distribution (distractor analysis), attempt counts, time used.

**Integrity without surveillance:** shuffled questions/options per attempt; single open attempt; server marking; no answers ever sent to the client; server-authoritative timer; rate-limited save calls; audit trail; **no** camera/screen monitoring, no tab-spying penalties (an optional gentle "you left the tab" notice is non-punitive and off by default).

### 6.2 Theory examination (authoritative source: supplied 7-question paper)

1. **Eligibility**: `create_theory_submission()` checks the objective gate (§7) and refuses otherwise. RLS on `INSERT` for `theory_submissions` repeats the same check, so both paths are covered.
2. **Display**: all 7 questions with their module tags and sub-part marks — exactly as printed.
3. **Selection**: `select_theory_questions(submission_id, uuid[5])` validates: array length **= 5**, all unique, all belong to this exam, submission still `draft`. Any other length raises an explicit error (`THEORY_SELECTION_MUST_BE_EXACTLY_5`).
4. **Answering**: `save_theory_answer(submission_id, question_id, text)` upserts while `status = 'draft'`, stores word count; client autosaves on debounce + on page hide. 2-hour server-side deadline with grace handling (configurable).
5. **Submit** `submit_theory_submission()`: verifies `status = 'draft'`, exactly 5 selected, exactly 5 non-empty answers (DB trigger double-checks the invariant) → `submitted`, answers become immutable to the student (function revokes further edits by refusing).
6. **Grading queue**: admin sees submissions `submitted` → opens → marks each of 5 answers 0–20 with feedback; the printed model answer and the source caveat ("indicative rather than exhaustive…") are displayed **only to the grader**; an optional AI hint can be added later but the human presses "Save grade".
7. **Total**: trigger computes `total_score = SUM(score)` when all 5 graded; status → `graded`.
8. **Release** → `released`: the learner sees per-question marks, feedback and total. Results policy is a setting (`release_policy`: immediate | after_all_graded | manual).
9. **Guard rails**: students have no `UPDATE` on grades; only staff of that course can insert grades; every grade stores `graded_by` and `graded_at`; re-grading creates an audit entry with before/after.
10. **Exactly-5 invariant also enforced by**: `CHECK`/trigger on `theory_answers` count, and the UI selector which disables submission until 5 are chosen (UI is convenience, not security).

### 6.3 Knowledge checks (formative) and practical activities

- Knowledge checks reuse the same engine with `type = 'knowledge_check'`: unlimited attempts, instant feedback, no impact on final grade, gates lesson completion only.
- Practical activities (Appendix A) store a written submission; completion by self-certification or staff approval; model solutions/rubrics are staff-only until released.

---

## 7. The 70% progression rule

| Aspect | Design |
|---|---|
| **Source of truth** | `system_settings.objective_pass_mark = 70` (single row, admin-editable, change is audited). |
| **Enforcement point 1** | `create_theory_submission()` refuses if no objective attempt satisfies `percentage >= pass_mark` (and `passed = true`). Error: `OBJECTIVE_GATE_NOT_PASSED`. |
| **Enforcement point 2** | RLS `INSERT` policy on `theory_submissions` calls the same predicate — direct API calls are blocked even if application code is bypassed. |
| **Enforcement point 3** | Any `SELECT` of theory content through helper views also requires the gate (so a curious learner cannot read theory questions early). |
| **Enforcement point 4 (UX only)** | Dashboard shows a clear status badge: **Locked / Eligible / In progress / Submitted / Passed / Needs retry**, with "You scored 68% — 2% to go" plus chapter-level revision targets. |
| **Retake policy** | Configurable: unlimited attempts (default) or N attempts; best attempt counts (default) or latest. Below-threshold learners see exactly which chapters to revisit. |
| **Changing the pass mark** | Allowed by superadmin, audited, and documented in the UI as *"changes apply to new eligibility checks"*; never re-marks past attempts. |
| **Why database-side** | A browser flag, a modified response, or a replayed API call cannot satisfy an `EXISTS` predicate evaluated inside Postgres. |

---

## 8. The theory "5-of-7" rule

**Requirement:** display 7 questions, learner answers exactly 5, each worth 20 marks, total 100, submission rejected for fewer or more than 5.

**Five independent checks:**

1. **Selector UI** — shows 7 cards with checkboxes; a counter reads "3 of 5 selected"; Submit disabled until exactly 5; deselecting frees a slot; the 2 unselected questions are visibly shown as "not chosen".
2. **Selection RPC** — `select_theory_questions()` rejects length ≠ 5, duplicates, or questions outside the exam.
3. **Submission RPC** — `submit_theory_submission()` requires 5 selected **and** 5 non-empty answers (minimum length validated), and that the submission is still `draft` (prevents double-submit).
4. **Database trigger** — `BEFORE INSERT OR UPDATE ON theory_answers` maintains the invariant that a `submitted` submission has exactly 5 answers; violations raise `THEORY_ANSWER_COUNT_INVALID`.
5. **Grading UI** — always shows exactly 5 grade slots of 0–20; total cannot exceed 100 (CHECK constraint `total_score BETWEEN 0 AND 100`).

**Marking:** each selected question = 20 marks maximum; `total_score` computed only from the 5 selected answers; the 2 unselected questions remain visible in the record (status `not_selected`) for audit completeness.

---

## 9. Database architecture

*Design complete; DDL is written as migrations in Phase 2 (not before, so schema and code land together and are tested together).*

### 9.1 Conventions

- `uuid` primary keys (`gen_random_uuid()`), `timestamptz` everywhere, `created_at/updated_at` with a shared trigger, `updated_by` on sensitive tables.
- Naming: `snake_case`, plural tables, `*_id` foreign keys, `status` as `text` + `CHECK` (readable, extensible), booleans prefixed `is_`/`requires_`.
- Soft delete: only where history matters — `courses.status`/`lessons.status` use `draft|published|archived`; learner data (attempts, grades) is **never** hard-deleted by the UI; `profiles.deleted_at` for account closure. Content rows are archived, not destroyed.
- Every table gets indexes on foreign keys, `status`, and the columns RLS predicates touch (RLS predicates run per-row — indexes are part of security design here).
- `audit_logs` is append-only (no `UPDATE`/`DELETE` policy for anybody).

### 9.2 Schema (33 tables)

**Identity & access (5)**

| Table | Key columns / notes |
|---|---|
| `profiles` | `id` (= `auth.users.id`), `full_name`, `email`, `avatar_path`, `institution`, `bio`, `locale`, `deleted_at`; created by trigger on signup. |
| `roles` | `code` unique (`superadmin`,`admin`,`student`), `name`, `description`. |
| `permissions` | `code` unique, `description`. |
| `role_permissions` | `(role_id, permission_id)` PK. |
| `user_roles` | `(user_id, role_id)` PK, `granted_by`, `granted_at`. **No self-grant path.** |
| `course_staff` *(added)* | `(course_id, user_id, staff_role)` — needed so an Admin/Instructor's scope is "assigned courses" rather than everything. |

**Course structure (7)**

| Table | Key columns / notes |
|---|---|
| `courses` | `code` ('LIS 815'), `title`, `description`, `status` (`draft/published/archived`), `enrolment_open`, `instructor_id`, `version`. |
| `modules` | `course_id`, `position` (1–7), `title`, `description`, `status`. Unique `(course_id, position)`. |
| `chapters` | `module_id`, `position` (1–14 within course), `title`, `summary`, `slug`, `status`. |
| `lessons` | `chapter_id`, `position`, `title`, `kind` (`reading/check/practical`), `is_required`, `est_minutes`, `required_reading_pct`, `min_seconds`, `required_assessment_id`, `required_assessment_min_score`, `requires_approval`, `resume_anchor`, `status`. |
| `lesson_sections` | `lesson_id`, `position`, `kind` (`prose/example/formula/exercise/checkpoint`), `title`, `content_md`, `is_required`, `estimated_words`. |
| `lesson_prerequisites` | `(lesson_id, prerequisite_lesson_id)` — explicit graph; linear order also available via `(chapter_id, position)`. |
| `reading_events` | `user_id`, `lesson_id`, `pct`, `section_id`, `seconds`, `created_at`; append-only, throttled, retained 180 days then aggregated (free-tier hygiene). |

**Learner state (3)**

| Table | Key columns / notes |
|---|---|
| `course_enrollments` | `(course_id, user_id)` unique, `status` (`active/completed/dropped`), `enrolled_at`, `completed_at`, `progress_pct`, `required_lessons_done`. |
| `lesson_progress` | `(user_id, lesson_id)` unique, `status` (`in_progress/completed`), `reading_pct`, `seconds_spent`, `started_at`, `completed_at`, `completed_by` (`self/approval`), `last_section_id`. |
| `knowledge_check_results` *(implicit via assessment tables)* | formative results reuse `assessment_attempts` filtered by type — no duplicate table. |

**Assessments (6)**

| Table | Key columns / notes |
|---|---|
| `assessments` | `course_id`, `type` (`knowledge_check/objective/theory/practical`), `title`, `description`, `duration_minutes`, `max_attempts`, `pass_mark`, `randomize_questions`, `randomize_options`, `show_correct_answers`, `availability_*`, `prerequisite` (`all_lessons/none`), `status`. |
| `question_banks` | `course_id`, `name`, `description` — organisational container (the supplied objective paper = one bank). |
| `questions` | `bank_id`, `assessment_id` (nullable for bank-wide), `chapter_id`, `module_id`, `stem_md`, `type` (`mcq`), `points` (1), `explanation_md` (staff-only), `source` (`supplied/lms-authored`), `source_ref` (e.g. "Obj Q42"), `position`, `status`. |
| `question_options` | `question_id`, `label` (A–D), `text`, `position`, **`is_correct`** (never exposed to students). Unique `(question_id, label)`. |
| `assessment_attempts` | `assessment_id`, `user_id`, `attempt_no`, `status` (`in_progress/submitted/marked/expired`), `started_at`, `expires_at`, `submitted_at`, `score`, `total`, `percentage`, `passed`, `question_order jsonb`. Unique `(user_id, assessment_id, attempt_no)`; **partial unique** `(user_id, assessment_id)` where `status='in_progress'`. |
| `attempt_answers` | `attempt_id`, `question_id`, `selected_option_id`, `is_correct`, `answered_at`. Unique `(attempt_id, question_id)`. |

**Theory examination (3)**

| Table | Key columns / notes |
|---|---|
| `theory_submissions` | `assessment_id`, `user_id`, `selected_question_ids uuid[5]`, `status` (`draft/submitted/under_review/graded/released`), `started_at`, `expires_at`, `submitted_at`, `total_score` (0–100), `overall_feedback`, `graded_by`, `graded_at`, `released_at`. One active draft per user (partial unique index). *Named per your brief; corresponds to "theory_attempts" in `OPENCODE_MASTER_PROMPT.md`.* |
| `theory_answers` | `submission_id`, `question_id`, `answer_text`, `word_count`, `score` (0–20), `feedback`, `status` (`not_selected/draft/graded`). Unique `(submission_id, question_id)`; trigger enforces exactly 5 non-null answers on submit. |
| `theory_grades` | `theory_answer_id` unique, `score`, `feedback`, `graded_by`, `graded_at`, `rubric_ref`. Kept separate from `theory_answers` so **grading writes and answer writes are different privileges** — a student writing an answer cannot touch the grade column. |

**Content support (6)**

| Table | Key columns / notes |
|---|---|
| `resources` | `course_id` + optional `module_id/chapter_id/lesson_id`, `title`, `description`, `kind` (`file/link/exam_paper`), `storage_path`/`url`, `visibility` (`students/staff`), `source`, `status`. **Exam-paper resources default to `staff`.** |
| `glossary_terms` | `course_id`, `term`, `slug`, `definition`, `module_id`, `related_term_ids uuid[]`, `example`, `notes`, `source` (`supplied/supplementary`), `position`. |
| `notes` | `user_id`, `lesson_id`, `section_id`, `body`, `selection`; own-rows only. |
| `bookmarks` | `user_id`, `kind` (`lesson/glossary/resource`), `ref_id`, `created_at`; unique per user+ref. |
| `announcements` | `course_id`, `title`, `body_md`, `audience`, `publish_at`, `status`, `pinned`. |
| `notifications` | `user_id`, `type`, `title`, `body`, `link`, `read_at`. |

**Outcomes & platform (6)**

| Table | Key columns / notes |
|---|---|
| `practical_activities` | `course_id`, `chapter_id`, `title`, `instructions_md`, `rubric jsonb`, `model_solution_md` (staff-only until released), `is_required`, `position`, `status`. |
| `practical_submissions` | `activity_id`, `user_id`, `body`, `status`, `score`, `feedback`, `graded_by`. |
| `certificates` | `user_id`, `course_id`, `certificate_number` (unguessable, unique), `issued_at`, `issued_by`, `status` (`issued/revoked`), `revoked_reason`, `eligibility_snapshot jsonb`. Public verification reads **only** number, name, course, completion date, status. |
| `system_settings` | `key` PK, `value jsonb`, `description`, `is_secret`, `updated_by`, `updated_at`. Holds pass marks, thresholds, policies, assessment weights from the source assessment guide. |
| `audit_logs` | `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `ip`, `user_agent`, `created_at`. Append-only; also receives completion events, exam submissions, grade changes, role changes, setting changes. |
| `search_index` | `entity_type`, `entity_id`, `course_id`, `title`, `body`, `title_tsv`/`body_tsv tsvector` (GIN), maintained by triggers on the underlying tables. Powers §14 search with plain PostgreSQL full-text search — **no paid search service.** |

**Deliberately not created** (avoiding complexity for its own sake): a generic `grades` table (course-grade book is future work, §22), `certificate_verifications` (folded into `audit_logs`), `lesson_completion_events` (folded into `audit_logs` with `entity_type='lesson_progress'`), `notifications_channels`/email queues (in-app only at first), `forums`, `live_sessions`.

### 9.3 Key relationships (ERD in words)

```
courses 1─* modules 1─* chapters 1─* lessons 1─* lesson_sections
lessons *─* lessons            (via lesson_prerequisites — self-referencing graph)
users 1─* course_enrollments *─1 courses
users 1─* lesson_progress *─1 lessons
assessments 1─* assessment_attempts 1─* attempt_answers *─1 question_options
assessments 1─* questions 1─* question_options        (questions also *─1 chapters)
assessments 1─* theory_submissions 1─* theory_answers 1─1 theory_grades
users 1─* certificates *─1 courses
users 1─* user_roles *─1 roles *─* permissions
course_staff: courses *─* users  (scope for admin/instructor)
```

### 9.4 Critical constraints & indexes (partial list)

- `UNIQUE (course_id, position)` on modules/chapters/lessons/lesson_sections → reorder stays consistent.
- `CHECK (percentage BETWEEN 0 AND 100)`, `CHECK (score >= 0)`, `CHECK (total_score BETWEEN 0 AND 100)`.
- `CHECK (label IN ('A','B','C','D'))`, exactly one correct option enforced by trigger.
- Partial unique indexes: one in-progress attempt; one active theory draft.
- `EXCLUDE` not needed; `FOREIGN KEY ... ON DELETE RESTRICT` on assessment history (results are never orphan-deleted).
- GIN on `tsvector` columns; B-tree on `(user_id, status)`, `(assessment_id, status)`.

---

## 10. Supabase architecture

### 10.1 Why Supabase fits

Postgres + Auth + Storage + Row Level Security + a SQL editor + migrations, all on a free tier, with the security rules living **inside the database**. No server to maintain.

### 10.2 Project layout in the repo

```
supabase/
├── migrations/        # ordered .sql files — the single source of truth for schema+RLS+functions
├── seed/              # content JSON/MD → imported by npm run db:seed
└── config.toml        # local/dev config (optional; see note on local stack)
```

- **Migrations are hand-authored SQL** (no ORM). Plain SQL is inspectable, matches Supabase's own tooling, and avoids an ORM/RLS impedance mismatch. `npm run db:migrate` applies them in order via the Supabase CLI or a small runner script using the connection string.
- **Seed pipeline:** `content/**/*.md|json` → validator → SQL inserts, idempotent (`ON CONFLICT` upserts keyed by stable slugs), re-runnable any time.

### 10.3 Runtime data access (three channels, no others)

| Channel | Used for | Runs as |
|---|---|---|
| **RLS-guarded reads/writes** (`supabase-js`) | Normal browsing, notes, bookmarks, announcements, own rows | Authenticated user (anon/authenticated roles) |
| **Database functions / RPC** | Anything sensitive: reading events, completion, attempt lifecycle, marking, theory selection/submission, grading, role changes, settings, certificate issue/verify | `SECURITY DEFINER` — code executes with definer rights **after** checking `auth.uid()` and roles |
| **Service-role key** | Server-only: migrations, seeding, scheduled jobs, admin-only server routes | **Never** leaves the server; no `NEXT_PUBLIC_` prefix, no client import, checked by a lint rule + build-time env validation |

### 10.4 Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=           # safe for browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # safe for browser (RLS still applies)
SUPABASE_SERVICE_ROLE_KEY=          # SECRET — server only, never in .env.local NEXT_PUBLIC_*
```

`.env.example` is committed; `.env.local` is git-ignored; a startup validator fails the build loudly if a `NEXT_PUBLIC_` name collides with a secret.

### 10.5 Storage buckets

| Bucket | Access | Purpose |
|---|---|---|
| `avatars` | public read / owner write | Profile pictures (size + MIME checked) |
| `resources` | private; RLS via `course_staff` + enrolment | Course PDFs and downloads; exam papers restricted to `staff` |
| `submissions` | private; owner + staff | Practical/theory file attachments (if enabled later) |

### 10.6 Edge functions

**None initially.** Everything needed can run in Postgres functions or Next.js server code. Avoiding Edge Functions keeps the free-tier footprint and moving parts small. (If a scheduled job is later needed — e.g. auto-expire attempts — a single Edge Function or Vercel cron on the free tier suffices; expiry is *also* enforced lazily on every read/write, so the scheduler is a tidiness feature, not a correctness requirement.)

### 10.7 Local development

- Default path: a real Supabase project used as **dev** (simplest for a non-coder; no Docker).
- Optional path: `supabase start` local stack for developers who have Docker (documented, not required).
- Separate **dev** and **prod** Supabase projects so experiments never touch real learner data.

---

## 11. Authentication architecture

| Aspect | Design |
|---|---|
| Provider | Supabase Auth (email + password). Google OAuth can be added later free, but is **not** required initially (avoids console setup friction). |
| Signup | Email/password → `profiles` row created by `ON INSERT` trigger on `auth.users`; role defaults to `student`. |
| Email confirmation | Configurable. Default plan: **enabled in production**, with Supabase's built-in email (free but rate-limited ~2–3 messages/hour). Fallback documented: custom SMTP via a free Gmail app password if volume grows. Dev: temporarily disable confirmation to reduce friction. |
| Session | Supabase SSR cookie sessions via `@supabase/ssr`; httpOnly, `SameSite=Lax`, Secure in production. |
| Password rules | Min 8 chars, breach-check via Supabase setting, reset link flow, rate-limited attempts. |
| Protected routes | Next.js **middleware** checks "is there a session cookie?" and redirects (fast, coarse) → then every page/action re-validates server-side with RLS as the authority. **Middleware is convenience; RLS is security.** |
| Role resolution | `has_role(code)` / `has_permission(code)` `SECURITY DEFINER STABLE` functions reading `user_roles` (avoids RLS recursion and is cached per transaction). Browser-supplied role claims are never trusted. |
| **Bootstrap superadmin** | Signed-up user visits a **one-time** `/setup/claim-superadmin` page that calls `claim_first_superadmin()`; the function succeeds **only if zero superadmins exist**, grants `superadmin` to the caller, writes an audit row, and permanently disables itself (guarded by `count(superadmins)=0`). No password in source, no manual SQL for you. After the first superadmin, the page reports "already initialised". |
| Account management | Own profile edit, password change, sign out; superadmin can deactivate accounts (soft), view sessions' last activity, manage roles. |
| Admin invitations | Superadmin/admin can create a user with a temp password via server route (service role, server-only) **or** simply share the signup link and promote afterwards — the promotion path is the audited role change. |

---

## 12. Authorization / RLS strategy

### 12.1 Principles

1. **Default deny.** Every table gets RLS enabled before any data is written.
2. **No direct sensitive writes.** Students hold `SELECT` on their own state rows; `INSERT/UPDATE/DELETE` on progress, attempts, answers, submissions, grades, certificates, roles, settings and audit logs is **revoked at the PostgreSQL privilege level** and re-exposed only through `SECURITY DEFINER` functions that validate the business rules.
3. **Helpers are `SECURITY DEFINER` + `STABLE`** to prevent policy recursion and to keep policy expressions cheap.
4. **Policies read like a spec** — one policy per operation, commented, with the permission code it maps to.

### 12.2 Helper functions (the vocabulary of every policy)

```sql
auth.uid()                       -- Supabase builtin
public.current_user_id()         -- stable wrapper
public.has_role(text)            -- 'superadmin' | 'admin' | 'student'
public.has_permission(text)      -- via role_permissions
public.is_course_staff(uuid)     -- superadmin OR (admin AND course_staff row)
public.is_enrolled(uuid)         -- active enrolment
public.can_access_lesson(uuid)   -- enrolled AND (no incomplete prerequisites) AND lesson published
public.objective_gate_passed(uuid) -- >= pass_mark on a marked attempt (§7)
public.settings(key)             -- read non-secret settings
```

### 12.3 Policy matrix (summary — full matrix is written into the migration file)

| Table | Student | Admin/Instructor | Superadmin |
|---|---|---|---|
| `profiles` | SELECT/UPDATE own (no role columns) | SELECT all, UPDATE scoped | all |
| `roles`,`permissions`,`role_permissions` | SELECT | SELECT | all |
| `user_roles` | SELECT own | SELECT own | all (**only** writers) |
| `courses/modules/chapters` | SELECT published | SELECT + manage assigned | all |
| `lessons/lesson_sections` | SELECT **only if `can_access_lesson()`** | manage assigned | all |
| `lesson_prerequisites` | SELECT | manage assigned | all |
| `course_enrollments` | SELECT own; INSERT (self-enrol when open) | manage assigned | all |
| `lesson_progress` | **SELECT own only** | SELECT assigned | all |
| `reading_events` | **INSERT via function only** (no direct writes) | SELECT assigned | all |
| `assessments` | SELECT published of enrolled course | manage assigned | all |
| `questions/question_options/question_banks` | **no direct SELECT** (RPC-gated paper) | manage assigned | all |
| `assessment_attempts` | SELECT own (score fields only) | SELECT assigned | all |
| `attempt_answers` | SELECT own (post-submit view) | SELECT assigned | all |
| `theory_submissions/theory_answers` | SELECT own; writes via RPC | SELECT assigned; status transitions | all |
| `theory_grades` | SELECT own **after release** | INSERT/UPDATE assigned | all |
| `practical_*` | own rows | assigned | all |
| `resources` | SELECT `visibility='students'` + enrolled | manage assigned | all |
| `glossary_terms` | SELECT | manage | all |
| `notes/bookmarks/notifications` | own rows only | — | all |
| `announcements` | SELECT published | manage assigned | all |
| `certificates` | SELECT own | manage assigned | all |
| `system_settings` | SELECT non-secret | SELECT non-secret | all |
| `audit_logs` | none | SELECT (if `audit.view`) | SELECT; **no UPDATE/DELETE for anyone** |
| `search_index` | SELECT (RLS of source entity applies via join check) | SELECT | all |
| `storage.objects` | own avatar; enrolled resources | manage course bucket | all |
| **Public** | `verify_certificate(number)` → minimal fields only | — | — |

### 12.4 Column-level protection (RLS cannot do columns, so we do)

- Students never `SELECT` `question_options.is_correct`, `questions.explanation_md`, `theory model answers`, `theory_grades` before release, `system_settings.is_secret` values, or role columns of `profiles`.
- Technique: revoke base-table `SELECT` where necessary and expose **narrow views** (`v_exam_paper_safe`, `v_own_results`, `v_certificate_public`) or RPC payloads that simply omit the columns. Views owned by the definer, `security_invoker` chosen deliberately per view.

### 12.5 Rate limiting (free, in-database)

`rate_limits(bucket, key, window_start, count)` checked inside RPCs: answer autosave (e.g. 60/min), login attempts (Supabase handles auth side), search queries (30/min), certificate verification (20/min/IP). Exceeding returns a clean `RATE_LIMITED` error. No third-party service.

---

## 13. Application architecture

### 13.1 Folder structure

```
lis815-lms/
├── app/
│   ├── (public)/            # landing, help, certificate verification
│   ├── (auth)/              # login, signup, reset, claim-superadmin
│   ├── (learner)/           # dashboard, course, learn/[lesson], assessments, results,
│   │                        # glossary, resources, notes, bookmarks, search, announcements
│   ├── (staff)/             # admin: content, question bank, exams, grading, learners, reports
│   ├── (superadmin)/        # users, roles, settings, audit logs, system analytics
│   ├── api/                 # thin route handlers where server actions don't fit (webhooks, exports)
│   ├── layout.tsx, globals.css, error.tsx, not-found.tsx, loading.tsx
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, dialog, tabs, table, toast…)
│   ├── learner/  staff/  assessment/  charts/
├── content/
│   ├── core/                # source-derived: modules/chapters/lessons (Markdown+frontmatter)
│   ├── enrichment/          # Supplementary Enrichment (badged)
│   ├── assessments/         # objective bank (100), theory (7), knowledge checks (LMS-authored)
│   ├── glossary/            # Appendix C terms + supplementary terms
│   ├── practicals/          # Appendix A exercises + rubrics
│   ├── revision/            # Appendix B revision centre
│   └── ISSUES.md            # source ambiguities log (never silently fixed)
├── lib/
│   ├── supabase/            # server.ts, client.ts, middleware.ts (SSR helpers)
│   ├── validation/          # Zod schemas (shared client/server)
│   ├── content/             # frontmatter parser, markdown pipeline
│   ├── exam/                # pure functions: marking, percentages, eligibility (unit-tested)
│   └── utils/
├── supabase/migrations/  seed/
├── tests/  e2e/
├── docs/                    # the three PDFs + extracted text
├── scripts/                 # db:migrate, db:seed, backup, promote-superadmin
├── .env.example
├── BUILD_PLAN.md  IMPLEMENTATION_CHECKLIST.md  DECISIONS.md  README.md  START_HERE.md
```

### 13.2 Rendering & data-flow strategy

- **Server Components by default.** Lesson pages, dashboards, lists and tables render on the server and call Supabase directly — near-zero client JavaScript for reading and browsing (the single biggest win for slow connections).
- **Client Components only where interactivity demands it:** exam runner (timer, autosave, navigator), theory editor, reading-progress tracker, filters/optimistic UI.
- **Server Actions** for mutations (enrol, note, bookmark, admin CRUD) with **Zod validation** on both client and server; every action re-checks role/ownership server-side (never trusts the form).
- **RPCs** (not server actions) for anything security-critical, so the rules survive even if someone bypasses the UI/API layer.
- **Caching:** course structure cached per request (`revalidate` on content publish); learner state always fresh (no cross-user cache); `router.refresh()` after mutations instead of a client state library.
- **Errors:** typed error boundaries per segment, toast for action failures, 404/empty/loading states for every data surface.

### 13.3 Dependencies (deliberately short list)

| Package | Why | Alternative rejected because |
|---|---|---|
| `next`, `react`, `typescript` | Required stack | — |
| `tailwindcss` | Required stack | — |
| `@supabase/supabase-js`, `@supabase/ssr` | Official Supabase for App Router | Hand-rolled session plumbing = risk |
| `zod` | One schema validates client + server | Duplicated ad-hoc validation = bugs |
| `react-markdown` + `remark-gfm` | Safe rendering of lesson Markdown (raw HTML not executed → XSS defence) | Storing HTML = XSS surface; heavy editors = bloat |
| `lucide-react` | Tree-shaken open-source icons | Bundled icon font = weight |
| `sonner` | Tiny accessible toast notifications | Custom toast = re-invented wheel |
| shadcn/ui primitives (`radix-ui` bits as used) | Accessible dialog/tabs/dropdown/menu you own | Full UI kits = lock-in; hand-rolling = a11y bugs |
| `qrcode` | Certificate QR generated **in the browser** | External QR API = paid/unreliable/third-party dependency |
| `vitest`, `@playwright/test` | Unit/integration + E2E, both free & open-source | Proprietary cloud test services = cost |
| `eslint` (+ `typescript-eslint`) | Static checking | — |

**Deliberately excluded:** ORM (Prisma/Drizzle) — plain SQL + Supabase client is simpler and RLS-native; `react-query`/Redux/Zustand — server components cover it; chart libraries — hand-built SVG/CSS bars for dashboards (lighter, faster); PDF libraries — certificates print via CSS (`Print to PDF`); paid AI SDKs — core LMS never needs them.

### 13.4 Key pure modules (unit-tested in isolation)

`lib/exam/marking.ts` (score, percentage, pass), `lib/exam/eligibility.ts` (objective gate, lesson completion predicates), `lib/content/frontmatter.ts`, `lib/validation/*.ts`. The **database is the enforcement layer**; these mirror it for instant UI feedback — both are tested against the same fixtures so they cannot drift.

### 13.5 Environment validation

`lib/env.ts` parses `process.env` with Zod at build/startup, failing fast with a readable message ("SUPABASE_SERVICE_ROLE_KEY is missing — copy it from Supabase → Settings → API"). Secrets are typed `server-only` via a `server-only` import guard so accidental client import fails the build.

---

## 14. UI/UX architecture

### 14.1 Design language

- **Tone:** serious modern university platform — calm, academic, uncluttered. No gamified confetti, no parallax.
- **Palette:** deep indigo/navy primary, warm amber accent for progress/highlights, neutral greys, semantic green/amber/red for status (always paired with **text + icon**, never colour alone). Contrast ≥ 4.5:1 for body text (checked with a contrast script in QA).
- **Typography:** one high-quality variable sans for UI/body (self-hosted via `next/font` — no Google Fonts CDN round-trip, faster in Nigeria), a restrained serif reserved for course/chapter titles. Modular scale (14/16/18/20/24/30/36), line-height 1.6 for reading, measure ~70ch for lesson text.
- **Density:** generous spacing, 8px grid, cards with subtle borders (not heavy shadows), clear hierarchy.

### 14.2 Layout system

- **Desktop:** collapsible left sidebar (module → chapter → lesson tree with status icons), top bar (search, notifications, avatar menu), main content area.
- **Tablet:** sidebar becomes a drawer.
- **Mobile:** compact top bar + hamburger drawer; sticky bottom "Continue / progress" bar in the reader; touch targets ≥ 44px; tables become stacked cards.
- **Reader:** sectioned content, sticky progress rail showing reading % + completion state, "Mark as completed" (disabled with an explanatory tooltip until server confirms readiness), prev/next with lock state visible.

### 14.3 Component inventory (built once, reused everywhere)

Buttons/inputs/select/checkbox/radio, card, badge/status pill, progress bar & ring, tabs, table (+ mobile card mode + sortable headers), dialog/confirm dialog, drawer/sheet, dropdown menu, toast, tooltip, breadcrumb, pagination, empty state, skeleton loader, error state with retry, file dropzone, search box with results, question navigator grid (exam), timer chip, markdown renderer, chart primitives (bar, donut, sparkline in pure SVG).

### 14.4 Screen map

| Area | Key screens |
|---|---|
| Public | Landing (course介绍, outcomes, enrol), Help/FAQ, **Certificate verification** (by number) |
| Auth | Sign in, Sign up, Reset password, Claim superadmin (one-time) |
| Learner | Dashboard · Course overview · Module/chapter page · Lesson reader · Knowledge check · Objective exam · Theory exam · Results · Revision centre · Glossary · Resources · Notes · Bookmarks · Search · Announcements · Profile/settings |
| Staff | Admin dashboard · Content manager (modules/chapters/lessons/sections, reorder, publish) · Question bank (list, editor, import) · Exam settings · Grading queue & grader · Learners & progress · Reports/export · Announcements · Resources · Certificates |
| Superadmin | System dashboard · Users · Roles/permissions · Course catalogue · System settings · Audit log · Analytics |

### 14.5 Dashboards (content specified)

**Learner:** course progress %, current module/lesson with "Continue", completed/remaining lesson counts, roadmap with locked/unlocked states, objective status (Locked/Eligible/Taken/Passed/Retry) + best score, theory eligibility badge, theory result, certificate status, recent activity feed, quick links (glossary, notes, announcements).

**Admin:** total learners, active this week, completion rate, exam attempts, average objective score, learners eligible for theory, theory submissions awaiting grading (with direct "Grade now"), completed learners, certificates issued/pending, recent registrations, content engagement (most/least viewed lessons), grading workload.

**Superadmin:** everything above across courses + user growth, role distribution, system health (last settings change, audit activity), storage/usage indicators, quick actions (settings, roles, exports).

All three: loading skeletons, meaningful empty states ("No submissions awaiting grading — you're up to date"), and filters/export (CSV) on every list.

### 14.6 Examination UX (mobile-first, low-bandwidth)

- One question at a time **with** a navigator grid (answered/unanswered/flagged), prev/next, autosave indicator ("Saved · 12:34 remaining"), warning before expiry, confirm-dialog on submit with unanswered count, review screen before final submit.
- Works at 360px width; no horizontal scrolling; minimal JS on the exam route only; answers survive connection loss (local buffer + retry queue, synced when back online — a *retry queue for non-critical writes*, per the low-bandwidth rule).
- Theory: question selection cards → then 5 answer textareas with autosave status, word count and a deadline banner.

### 14.7 Accessibility (WCAG 2.2 AA intent)

Semantic landmarks, skip-to-content link, visible focus rings, full keyboard operation (including the exam navigator and dialogs), `aria-live` for autosave/timer/status, labelled forms with inline errors, `prefers-reduced-motion` honoured, transcripts/captions if media is ever added, no colour-only meaning, screen-reader-friendly status announcements on completion.

### 14.8 Low-bandwidth / Nigerian connectivity realities

Server rendering + no client framework thrash; self-hosted fonts; compressed/next-gen images with `next/image`; lazy loading below the fold; no autoplay video; content pages are text-first; graceful offline/error banners with retry; print-friendly lesson and certificate styles; performance budget: **first contentful paint < 2s on throttled 3G emulation**, total JS on reading pages < 100KB gzipped (checked in QA).

---

## 15. Content architecture

### 15.1 Content lives in the repo, is seeded into the database

- **Why repo-first:** version history, diffs, review, rollback, and your ability to see exactly what changed — then `npm run db:seed` pushes it into Supabase where RLS, search and admin editing work.
- **Why also in the database:** the admin CMS can edit/publish without a developer; full-text search indexes it; enrolment/progress rules attach to it.
- **Editing model:** repo = authoritative import; admin CMS = approved ongoing edits; re-seeding uses upserts on stable slugs and never overwrites rows an admin has edited unless `--force` is passed (protects human edits).

### 15.2 File format (Markdown + YAML frontmatter)

```markdown
---
id: ch04-lesson-1-core-reading
source: supplied | supplementary | lms-authored
chapter: 4
position: 1
kind: reading
estimated_minutes: 25
required_reading_pct: 90
sections:
  - { kind: prose,   title: "4.1 What Is a Controlled Vocabulary?" }
  - { kind: example, title: "EXAMPLE" }
  - { kind: exercise, title: "Try it" }
---
```

### 15.3 Mapping: source → LMS objects

| Source element | LMS object | Notes |
|---|---|---|
| 7 modules | `modules` (position 1–7) | Titles verbatim |
| 14 chapters | `chapters` | Titles verbatim |
| Chapter learning objectives | first `lesson_sections` block (`kind: checkpoint`) | Verbatim |
| Numbered sections 1.1–14.8 | `lesson_sections` (kind prose/example/formula) | Verbatim text, lightly formatted to Markdown |
| Boxed EXAMPLE/WORKED EXAMPLE/FORMULA | `sections.kind = example/formula` | Distinct visual treatment |
| Chapter Review Questions | **Knowledge-check lesson** + a self-check section showing questions | MCQs are LMS-authored from this content (`source: lms-authored`) |
| Appendix A exercises | `practical_activities` + practical lessons | Rubrics staff-only until released |
| Appendix B short-answer + model answers | Revision centre (self-test) | Model answers revealed on demand |
| Appendix B essay questions | Revision centre (essay practice, optional submission) | — |
| Appendix C glossary (53 terms) | `glossary_terms` (`source: supplied`) | Searchable |
| Assessment & Examination Guide | Course "Assessment guide" page + `system_settings` weights | 20/15/15/50 recorded as source data |
| Final Revision Checklist | Revision centre checklist (progress-aware ticks) | — |
| Orientation, objectives, study guide, help | Orientation area lessons ("Start Here") + static pages | Outside the 7 modules so the course structure stays pristine |
| Objective paper (100 Q + key) | `questions` + `question_options` (`source: supplied`, `source_ref: "Obj Qn"`) | Key stored staff-side only |
| Theory paper (7 Q + models) | `questions` (type theory) + `theory_models` staff-only column | Verbatim; caveat text shown to graders |

### 15.4 Volume estimate (for free-tier budgeting)

Full text ≈ 100–200 KB + questions ≈ 60 KB + glossary ≈ 15 KB → well under 1 MB in a 500 MB database. Content is never the storage problem.

### 15.5 Content quality gates (before any seed is accepted)

1. Structural validator: every chapter has objectives, ≥1 section, review questions; every MCQ has exactly 4 options and exactly 1 correct; every theory question has sub-part marks summing to 20.
2. Answer-key cross-check: all 100 keys present and within A–D.
3. Source-fidelity check: question stems match extracted PDF text (fuzzy diff report).
4. `content/ISSUES.md` entries for any ambiguity — never silent fixes.
5. Label audit: zero rows with `source` missing; all enrichment badged.

---

## 16. Supplementary enrichment strategy

**Rule:** enrichment is additive, optional, never examinable, and always visibly labelled.

### 16.1 Placement model

- Enrichment units are `lessons` with `is_required = false` inside a clearly marked **"Supplementary Enrichment"** band at the end of the relevant module (plus a standalone Enrichment collection page).
- UI badge: **"Supplementary Enrichment — not part of the supplied LIS 815 source material"** shown on the unit and in search results.
- Enrichment never gates lesson/module completion or examination eligibility by default (setting exists to change this, default off).
- `source = supplementary` in data; a QA test asserts no `supplied` row contains enrichment text.

### 16.2 Candidate units (from `CONTENT_EXPANSION.md` / `AI_ENRICHMENT.md`, grouped)

1. IR fundamentals & the indexing/search relationship
2. Metadata, Dublin Core, MARC 21 orientation
3. Authority control & name/subject authorities
4. Controlled vocabularies beyond thesauri (subject headings, taxonomies, ontologies, classification)
5. Faceted classification & faceted search
6. Citation indexing; web/enterprise search
7. Full-text & inverted indexes; tokenisation, stop words, stemming, lemmatisation
8. NER, NLP for organisation; knowledge graphs & semantic search
9. Search ranking, relevance feedback; IR measures beyond P/R (F-measure, MAP, NDCG — LIS level)
10. Structured/informative/indicative/critical abstract quality (deepening, source-adjacent)
11. Scholarly communication, discovery, literature-review support; digital libraries & repositories; open access
12. AI-assisted indexing/abstracting workflows; generative AI risks (hallucination, bias, copyright, provenance, privacy); human-in-the-loop QA; prompt engineering for librarians
13. OCR of scanned documents; multilingual/cross-language retrieval
14. Accessibility & inclusive discovery; digital preservation/searchability
15. Nigerian/African library applications & case studies
16. Career pathways & workplace applications

Each unit: objectives → plain-language sections → example (preferably Nigerian LIS context) → self-check → "further reading" links (free sources only). Word count target 600–1,200/unit — substantial but not bloated.

---

## 17. Security strategy

### 17.1 Threats → controls

| Threat | Control |
|---|---|
| Answer key leakage | `is_correct` never readable by students; exam paper served only by RPC that strips answers; exam PDFs `visibility='staff'`; model answers staff-only until release; automated test asserts no student-role column/table exposes answers |
| Forging lesson completion | Completion only via `mark_lesson_complete()`; students have no write privilege on `lesson_progress`; prerequisites + reading aggregates re-checked in-database |
| Forging exam scores / theory marks | Students cannot `UPDATE` attempt score columns or insert grades; marking happens inside `SECURITY DEFINER` functions; grades written only by course staff; audit rows for every change |
| Bypassing the 70% gate | Gate predicate inside `create_theory_submission()` **and** in the `INSERT` RLS policy |
| Privilege escalation (self-promote) | No student/admin `INSERT`/`UPDATE` on `user_roles`; only superadmin + `role.manage`; bootstrap function works exactly once |
| Direct API/URL manipulation | RLS is the authority for every read; middleware checks are cosmetic; E2E tests attempt URL tampering |
| XSS via content | Markdown rendered with `react-markdown` (raw HTML disabled); CSP headers via `next.config` + Vercel headers; no `dangerouslySetInnerHTML` |
| SQL injection | Parameterised Supabase client calls; RPC arguments typed; no string-built SQL |
| Secrets in the bundle | `server-only` guard, `NEXT_PUBLIC_` allow-list, build-time env validation, `gitleaks`-style grep in CI, `.env.local` git-ignored |
| Duplicate/ concurrent submissions | Partial unique index (one open attempt) + idempotent submit (`WHERE status='in_progress'`) |
| Brute force / scraping | In-database rate limits on RPCs (answers, search, verification); Supabase auth rate limits; standard security headers |
| Tamper with audit trail | `audit_logs` has no `UPDATE`/`DELETE` policy for any role; inserts only via definer functions/triggers |
| Unsafe file uploads | Server-side MIME/size validation, randomised storage names, private buckets, no executable types, download served through an authorising route |
| Result/grade modification after release | Grade updates require `theory.grade` permission + create before/after audit rows; attempts are immutable after submit (`status` guard in functions) |
| Session theft | HttpOnly Secure cookies, short refresh, logout everywhere, no token in localStorage |

### 17.2 Secure examination submission (specifically)

Server-authoritative clock; answers accepted only while `in_progress` & unexpired; submit idempotent; marking server-side; per-question validation (option belongs to question); attempt ownership checked every call; answers and results transmitted only for the caller's own rows; audit on start/expire/submit.

### 17.3 Validation & input handling

Zod schemas shared client/server for every action; length limits (theory answer ≤ 10,000 chars), Markdown sanitisation, unicode normalisation, trimmed empties rejected, UUID format validated before use, structured error codes (`THEORY_SELECTION_MUST_BE_EXACTLY_5`, `OBJECTIVE_GATE_NOT_PASSED`, `LESSON_PREREQ_INCOMPLETE`, `ATTEMPT_EXPIRED`…) that map to friendly UI copy.

### 17.4 Privacy

Minimum personal data (name, email, institution); no invasive exam surveillance; audit stores IP/user-agent for sensitive admin actions only; data export (own data) and account-deletion request flows documented; GDPR-style considerations noted for future.

---

## 18. Zero-cost deployment strategy

> Third-party free-tier terms and limits change. Every figure below is an *indicative* figure to be re-checked at `supabase.com/pricing`, `vercel.com/pricing` and `github.com/pricing` at setup time, and recorded in `COSTS.md`.

| Service | Tier | Used for | Indicative free limits | Could cost if… |
|---|---|---|---|---|
| Supabase | Free | Postgres (≈500 MB), Auth (≈50k MAU), Storage (≈1 GB), Edge Functions | Project **pauses after ~7 days of inactivity** (log in weekly or use a keep-alive ping) | Data >500 MB, heavy egress, need PITR backups (Pro) |
| Vercel | Hobby | Hosting, HTTPS, previews, cron | ≈100 GB bandwidth/mo; **non-commercial use only** — fine for university teaching, re-check if commercialised | Commercial use, high traffic, team features |
| GitHub | Free | Source, CI minutes (2,000/mo) | Unlimited public/private repos | Larger teams/Actions minutes |
| Email | Supabase built-in | Confirmations, resets | ≈2–3 emails/hour | Volume → free Gmail SMTP (still £0) or paid provider |
| AI APIs (optional) | — | **Off by default; never required** | — | Only if you deliberately enable them |

**Cost principles:** no paid API in the core path; no per-seat fees; PDFs/images optimised to stay inside storage limits; reading events pruned after 180 days to protect the 500 MB budget; `COSTS.md` documents what is free, the limits, the upgrade triggers, and states plainly that **zero cost cannot be promised forever**.

**Nigerian-user specifics:** single-region hosting is acceptable (Supabase US/EU default; choose the region closest to the majority of users at project creation); text-first pages; no CDN-dependent critical assets; offline-tolerant exam autosave.

---

## 19. Testing strategy

### 19.1 Levels

| Level | Tool | When |
|---|---|---|
| Static | `tsc --noEmit`, ESLint, env validation | every commit (CI) |
| Unit | Vitest — pure logic (marking, eligibility, frontmatter, validation, formatting) | every commit |
| Database/RLS integration | Vitest + service-role against a **dedicated free Supabase test project** (`.env.test`): create users of each role, attempt forbidden reads/writes, assert refusals | every phase + CI when secrets present |
| E2E | Playwright (local browsers): full learner journey + failure paths | each major phase |
| Accessibility | axe-core automated + manual keyboard pass | Phase 12 |
| Performance | Lighthouse CI budgets (FCP/LCP/JS weight), throttled 3G run | Phase 12 |
| Content | Seed validator + answer-key cross-check + source-fidelity diff | content phases |

*Docker/local Supabase stack is optional; the default test path runs against a throwaway free Supabase project — simplest for this environment.*

### 19.2 Required test cases (traceable to `QA_ACCEPTANCE.md`)

**Learner path:** register → sign in → enrol → open Module 1 → locked lesson unreachable by URL → reading threshold blocks completion → completion unlocks next lesson → progress persists across sessions → chapter knowledge check gates → all lessons complete → objective exam appears.
**Objective:** 100 questions present; timer enforced; autosave; duplicate submit harmless; score/percentage correct (incl. edge 69/70/100); **69% does not unlock theory**; **70% does**; attempt history correct; randomisation preserves the correct answer; student cannot read `is_correct` through any role.
**Theory:** eligibility gate blocked before 70%; 7 questions visible; selecting 4 or 6 rejected (UI, RPC and trigger layers); 5 submitted; draft autosave; lock after submit; grader assigns 0–20 ×5; total auto-computed; release shows marks; student cannot write to `theory_grades`; model answers invisible to students.
**Roles/separation:** student blocked from `/admin`, `/superadmin`, content mutations, user listing; admin limited to assigned course; superadmin full; self-grant of role impossible; settings/audit protected.
**Integrity:** tampered completion request refused; replayed submit idempotent; forged percentage in a payload ignored (server recomputes); rate limits trip; service-role key absent from client bundle (build check).
**Certificate:** eligibility rules; issuance; public verify returns minimal fields; revoked certificate reports revoked; random numbers don't enumerate real certificates.
**UX/quality:** responsive at 360/768/1280; keyboard-only completion of a lesson and an exam question; focus visible; empty/loading/error states present; no dead links.

### 19.3 End-to-end acceptance (must pass before "done")

> Student registers → enrols → Module 1 → completes lesson under server rules → next unlocks → completes all required learning → takes the 100-question objective exam → scores ≥70% → theory unlocks → selects exactly 5 of 7 → submits → admin grades 5 answers → total computed → result released → certificate eligibility updates → certificate verifies publicly.
> Plus the failure paths: 69% score, skipping lessons, tampered completion, tampered score, unauthorised admin route, expired session, direct API manipulation.

### 19.4 Running tests (what you type)

```
npm run test          # unit + integration
npm run test:e2e      # browser journeys
npm run test:all      # everything, as CI does
```

---

## 20. Deployment strategy

### 20.1 Environments

| Env | Supabase | Vercel | Purpose |
|---|---|---|---|
| Local | none or dev project | `npm run dev` | development |
| Dev/Staging | **Supabase project #1** | Vercel *Preview* (per branch) | testing with real auth/RLS |
| Production | **Supabase project #2** | Vercel *Production* | live learners |

### 20.2 Pipeline

GitHub push → GitHub Actions (free): install → lint → typecheck → unit tests → build → (optional) E2E against staging → Vercel preview deploy; merge to `main` → production deploy. Migration step runs explicitly for production (never auto-migrate on deploy without review) via `npm run db:migrate:prod`.

### 20.3 The non-coder deployment runbook (summary — full copy-paste version lives in `START_HERE.md` at Phase 14)

1. Install Node.js LTS (one download) + create free GitHub account.
2. Create free Supabase project → copy **Project URL** and **anon key** into `.env.local` (exact file, exact lines shown).
3. Run `npm install`, `npm run db:migrate`, `npm run db:seed`.
4. `npm run dev` → open http://localhost:3000 → sign up → claim superadmin.
5. Push to GitHub (I generate the commands).
6. Import repo to Vercel → add the same env vars + `SUPABASE_SERVICE_ROLE_KEY` (server-only) → deploy.
7. In Supabase: add the Vercel domain to **Auth → URL Configuration** (redirect URLs).
8. Run the post-deploy verification checklist (auth, RLS, exam, gate, grading, certificate).

---

## 21. Backup & recovery considerations

| Data | Free-tier protection | Our mitigation |
|---|---|---|
| Database | Supabase free: daily backups **not** guaranteed (PITR is a paid feature) | `npm run db:backup` → encrypted-at-rest `pg_dump` to your machine/GitHub-private release; weekly manual trigger documented; settings remind monthly |
| Course content | Already in Git (every push = backup) | `db:seed` can rebuild content tables from repo |
| Learner results | Included in `pg_dump` | Plus quarterly CSV exports (results, grades) to a private folder — human-readable insurance |
| Files (resources) | Supabase storage | Downloadable mirror via `npm run storage:pull` (optional script) |
| Auth users | Supabase-managed | Exported via admin report (email/name) so accounts can be rebuilt |
| Git repo | GitHub | Local clone + GitHub = two copies |

**Recovery drills (documented in `DEPLOYMENT.md`):**
1. New Supabase project → run migrations → restore dump → set env → verify.
2. RPO target: ≤1 week (weekly dump) / RTO: ≤2 hours for a full restore into a fresh project.
3. Because migrations + seeds are deterministic, even a total DB loss rebuilds the *course* quickly; learner results depend on the dump frequency.

---

## 22. Future expansion possibilities

1. **Certificate rules v2** — configurable condition builder (e.g. include practical pass), manual override with audit.
2. **Course-grade book** — the supplied weights (Practicum 20 / Portfolio 15 / Mid-Term 15 / Final 50) as grade columns; deliberately deferred (FR scope).
3. **Multi-course catalogue** — schema is already multi-course; enable a second course with no structural change.
4. **Branching prerequisites** — `lesson_prerequisites` already supports non-linear paths.
5. **Optional AI grading assistant** — admin supplies their own key; suggestion only; grader always confirms; **never** a core dependency.
6. **Forums/discussions, live sessions, LTI/SCORM import, Moodle interoperability.**
7. **PWA/offline reading** (service worker) — after real usage data shows the need; do not claim offline support until tested.
8. **Multilingual UI** (English/Yoruba/Hausa), i18n scaffolding kept simple.
9. **Mobile app wrapper** — the responsive web app can be wrapped later (Capacitor) without a rewrite.
10. **Payments** (if ever commercial) — would trigger a Vercel tier review (see §18).

---

## 23. Risks and mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | Answer key or model answers leak to students | Critical (academic integrity) | Medium | §17.1 row 1; staff-only visibility; automated leakage tests; exam PDFs not in student resources |
| R2 | Supabase free project pauses after inactivity | High (site down) | Medium | Weekly login/keep-alive ping script + documented un-pause; alerts in dashboard |
| R3 | Supabase/Vercel free-tier limits change or exceed budget | High | Medium | `COSTS.md` monitoring notes; content is tiny; upgrade triggers documented; no vendor-specific lock-in |
| R4 | Vercel Hobby commercial-use restriction | Medium | Low | University/non-commercial use assumed; documented; easy migration to another free host (it's standard Next.js) |
| R5 | Content transcription errors (100 questions + models) | High | Medium | Fuzzy-diff validator against extracted PDF text; human proof-read pass before exams open; `ISSUES.md` for ambiguities |
| R6 | RLS bugs expose or block data | Critical | Medium | Default-deny, per-phase RLS test suite, negative tests (student tries everything), code review checklist |
| R7 | Progression logic considered "unfair" (thresholds) | Low | High | All thresholds admin-configurable with clear learner-facing explanation of why something is locked |
| R8 | Timer disputes (slow connection) | Medium | Medium | Server grace window setting, autosave everywhere, "connection lost" banner, attempt never lost on refresh |
| R9 | Email deliverability (confirmation never arrives) | Medium | High | Documented troubleshooting; admin can resend/invite; optional free SMTP path |
| R10 | Bus factor: only one developer understands it | Medium | High | This plan + `DECISIONS.md` + migrations as documentation + short, conventional stack |
| R11 | You (non-coder) get stuck at a setup step | High | Medium | `START_HERE.md` with exact clicks, screenshots-in-words, and copy-paste commands; each phase ends at a checkpoint |
| R12 | Data loss (no PITR on free tier) | High | Low | §21 backup schedule + CSV exports + Git content |
| R13 | Scope creep delays a working system | Medium | High | Phased plan with hard gates; MVP = Phases 1–8; enrichment/dashboards/polish after |
| R14 | Exam questions fetched but student leaves mid-attempt | Low | High | Resume policy; `in_progress` attempt resumes with saved answers; expiry handled gracefully |
| R15 | Over-engineering harms maintainability | Medium | Medium | Dependency allow-list; no ORM/Edge functions by default; every phase reviewed for simplicity |

---

## 24. Development phases

*Each phase ends with: typecheck ✔, lint ✔, tests ✔, running app ✔, short report to you. **No phase starts until the previous gate passes.** (Detailed task breakdown is in `IMPLEMENTATION_CHECKLIST.md`.)*

| Phase | Name | Outcome | Gate (verified when…) |
|---:|---|---|---|
| 0 | **Discovery & architecture** | This document + checklist; all sources read; content inventory | You approve the plan |
| 1 | Scaffold & design system | Next.js+TS+Tailwind app runs; component kit; env validation; docs skeleton | `npm run build` passes; landing page renders responsive |
| 2 | Database, migrations, RLS | All 33 tables, functions, policies, settings seeded; test users | RLS test suite passes (student blocked, admin scoped, superadmin full) |
| 3 | Auth & roles | Sign up/in/out/reset; profiles; role assignment; one-time superadmin claim | 3 roles sign in; role change audited; no self-grant |
| 4 | Content pipeline & seed | Validator + importer; all 7 modules/14 chapters/appendices imported; fidelity report | Structure matches source TOC; validator green; issues logged |
| 5 | Course reader & progression engine | Sectioned reader, reading tracking, completion RPC, sequential unlocking, resume | URL-tamper test fails; completion requires threshold; unlock works |
| 6 | Knowledge checks + objective exam + 70% gate | Full exam engine, timer, autosave, marking, gate, history, admin basics | 69% blocked / 70% passes; duplicate submit safe; answers never sent |
| 7 | Theory exam & grading | 5-of-7 selection, drafts, submit lock, grader UI, release | All five validation layers reject 4/6 selections; totals correct |
| 8 | Learner tooling | Glossary, notes, bookmarks, search, announcements, resources, revision centre | Search returns correct hits; own-rows-only enforced |
| 9 | Dashboards & analytics | Learner/Staff/Superadmin dashboards, reports, question analytics | Metrics reconcile with seeded data |
| 10 | Certificates & verification | Eligibility rules, issuance, printable cert + QR, public verify | Verify page reveals only minimal fields; revoked state works |
| 11 | Practical labs & enrichment content | Appendix A activities + all Supplementary Enrichment units badged | Labelling audit passes; enrichment never gates exams |
| 12 | Accessibility, performance & polish | Axe fixes, keyboard passes, perf budget, empty/error states, mobile exam pass | Lighthouse/axe thresholds met; 360px exam usable |
| 13 | Full QA | Complete test matrix incl. failure paths + security sweep + content proof-read | 100% of §19.2 cases pass; `npm run test:all` green |
| 14 | Deployment & documentation | GitHub + Vercel live; `START_HERE.md`, `COSTS.md`, `SECURITY.md`, `DEPLOYMENT.md`, `DECISIONS.md` | Live URL: full journey completed on production |

**MVP definition:** Phases 1–8 deliver a teachable, assessable course. Phases 9–14 professionalise and ship it.

---

## 25. Definition of Done

The project is **done** only when every line is true:

**Functional**
- [ ] App builds and starts with zero errors; no console errors in normal flows
- [ ] Supabase authentication works (signup, login, reset, logout) for all three roles
- [ ] Roles enforced: student / admin(assigned) / superadmin separation proven by tests
- [ ] RLS proven by negative tests on **every** user-facing table
- [ ] All 7 modules / 14 chapters / appendices present and faithful to source (fidelity report attached)
- [ ] Sequential progression enforced **server-side**; URL/API tampering proven to fail
- [ ] Progress persists and resumes correctly across sessions/devices
- [ ] Objective bank = the supplied 100 questions, 4 options, 1 correct, 1 mark each, 90-min default
- [ ] Automatic marking accurate; percentages correct; attempt history intact; duplicate submission harmless
- [ ] 70% gate enforced in database (69% blocked, 70% allowed) with all UI states shown
- [ ] Theory exam = 7 questions displayed; exactly-5 enforced at UI + RPC + DB trigger; totals = sum of five 0–20 marks
- [ ] Grading workflow with per-question marks, feedback, grader identity, release states
- [ ] Dashboards correct for all three roles, with empty/loading/error states
- [ ] Certificates issued per configurable rules and verifiable publicly with minimal data
- [ ] Glossary, search, notes, bookmarks, announcements, resources, revision centre all working
- [ ] Enrichment visibly badged as **Supplementary Enrichment**; zero enrichment presented as source

**Quality**
- [ ] `tsc --noEmit`, ESLint, unit, integration, E2E suites all pass in CI
- [ ] Production build passes; no `SUPABASE_SERVICE_ROLE_KEY` (or any secret) in the client bundle
- [ ] Responsive at 360 / 768 / 1280; keyboard-only paths for core journeys; contrast checked
- [ ] Performance budget met on throttled 3G (reading pages text-first, JS-light)
- [ ] No dead links or placeholder buttons in production views

**Operational**
- [ ] Deployed to production URL; auth redirect URLs configured; HTTPS active
- [ ] Backups scheduled and a restore drill documented (and once performed)
- [ ] Documentation complete: `README`, `START_HERE`, `ARCHITECTURE`, `DATABASE`/`SECURITY`/`RLS`, `ASSESSMENT_ENGINE`, `CONTENT_MODEL`, `DEPLOYMENT`, `COSTS`, `TEST_PLAN`, `DECISIONS`, `CHANGELOG`
- [ ] No secrets committed; `.env.example` complete; `COSTS.md` honest about limits
- [ ] No paid service required for any core feature

---

## Appendix A — Objective question → chapter map (discovery result)

*Derived by reading all 100 questions; used to tag questions in the seed and to build chapter-level revision guidance.*

| Questions | Count | Chapter / focus |
|---|---:|---|
| 1–7 | 7 | Ch 1 — Fundamentals & objectives of subject indexing (definitions, Lancaster, objectives, principles, assigned indexing, early retrieval) |
| 8–14 | 7 | Ch 2 — Types of indexes & book indexing (index vs TOC, components, name index, stages) |
| 15–21 | 7 | Ch 3 — Semantics & syntax (meaning, BT/NT/RT, syntax, role operators, citation order) |
| 22–28 | 7 | Ch 4 — Thesaurus design & term selection (controlled vocab, USE/UF, candidate terms, hierarchy direction) |
| 29–35 | 7 | Ch 5 — Thesaurus structure & maintenance (scope notes, displays, maintenance, software) |
| 36–42 | 7 | Ch 6 — Classic pre-coordinate techniques (chain, cyclic, pros/cons, cycled entry) |
| 43–49 | 7 | Ch 7 — Permuted & algorithmic systems (SLIC, PRECIS, operators, context) |
| 50–56 | 7 | Ch 8 — Post-coordinate systems (Uniterm, free-text, optical coincidence, flexibility) |
| 57–63 | 7 | Ch 9 — Search strategies & derived indexing (Boolean, KWIC/KWOC, automation) |
| 64–69 | 6 | Ch 10 — Evaluation methodologies (relevance, exhaustivity, specificity, Cranfield) |
| 70–77 | 8 | Ch 11 — Precision, recall & optimisation (formulas, worked calculations, trade-off) |
| 78–84 | 7 | Ch 12 — Abstracting techniques & types (indicative/informative/critical/slant/structured) |
| 85–90 | 6 | Ch 13 — Uses & applications (CAS, SDI, services, extractive/abstractive) |
| 91–98 | 8 | Ch 14 — Automatic indexing, tools & AI (workflow, CINDEX, hyperlinked/dynamic, NER, Washington) |
| 99–100 | 2 | Cross-cutting synthesis (originator pairings; indexing + abstracting relationship) |
| **Total** | **100** | |

## Appendix B — Theory question → module map (source-declared)

| Q | Module | Sub-marks | Total |
|---|---|---|---:|
| 1 | M1 — Theoretical Foundations & Types of Indexes | 6+6+8 | 20 |
| 2 | M2 — Vocabulary Control | 5+7+8 | 20 |
| 3 | M3 — Pre-Coordinate Indexing Systems | 6+5+9 | 20 |
| 4 | M4 — Post-Coordinate & Derived Indexing | 6+6+8 | 20 |
| 5 | M5 — Performance Evaluation & System Metrics | 5+4+11 | 20 |
| 6 | M6 — Abstracting Principles & Applications | 5+9+6 | 20 |
| 7 | M7 — Digital, Automated & AI-Assisted Indexing | 6+6+8 | 20 |

*Answer any 5 → maximum 100 marks. Model answers are indicative, not exhaustive — this caveat ships with the grader UI.*

## Appendix C — Key decisions (plain English summary)

1. **Database enforces the rules, not the website.** Locking, scoring and eligibility are Postgres functions/policies so a clever student cannot bypass them.
2. **No ORM, no paid services, no AI dependency.** Plain SQL + the official Supabase client keeps the stack small and free.
3. **Content lives in Git first, then seeds into the database** — you get version history *and* an admin editor.
4. **Server Components by default** — pages arrive as HTML, so reading works well on slow connections.
5. **Answer keys and model answers are quarantined** — students have no code path to them (the biggest academic-integrity risk found in the source files).
6. **"Exactly 5" and "≥70%" are checked five times and four times respectively** (UI, functions, constraints, RLS) — belt and braces.
7. **Certificates print via the browser** (no PDF library) and verify publicly by unguessable number.
8. **Testing runs against a real free Supabase project** — no Docker requirement for you.
9. **Enrichment is optional, badged and non-examinable.**
10. **Theory pass mark and certificate rules are configurable defaults**, explicitly *not* presented as source facts, because the source does not state them.

---

*End of BUILD_PLAN.md. Next deliverable: `IMPLEMENTATION_CHECKLIST.md`. No application code will be written until you reply: **"PROCEED TO PHASE 1"**.*
