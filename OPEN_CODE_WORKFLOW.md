# OpenCode Build Workflow

## Phase 1 — Understand
Read every file under /docs and all Markdown instructions before coding.

## Phase 2 — Plan
Produce a short implementation plan, database ERD, route map and role matrix. Do not start with decorative UI before the core data model is stable.

## Phase 3 — Scaffold
Create Next.js + TypeScript + Tailwind + Supabase integration. Add environment validation and a clean folder structure.

## Phase 4 — Database
Create migrations, seed data, RLS policies, helper functions and indexes. Run migrations and validate them.

## Phase 5 — Authentication
Implement sign-up/sign-in/sign-out/password recovery/profile. Add role-aware routing.

## Phase 6 — LMS
Implement course catalogue, course reader, progress tracking, sequential unlocking and completion rules.

## Phase 7 — Assessment
Implement objective bank/import, timed attempt, auto-marking, 70% gate, theory selection of exactly five of seven, manual grading and result history.

## Phase 8 — Enrichment
Add practical labs, glossary, notes, bookmarks, search, AI-literacy material and other clearly labelled supplementary content.

## Phase 9 — Dashboards
Build Student, Admin/Instructor and Superadmin dashboards with useful metrics and empty/error/loading states.

## Phase 10 — QA
Run type checks, linting, tests, accessibility checks and manual role-based acceptance tests.

## Phase 11 — Deployment
Document Supabase setup, environment variables, GitHub push and Vercel deployment. Keep paid services optional.

## Rule
At the end of each phase, report what was completed, what remains, and any command the non-coder needs to run.
