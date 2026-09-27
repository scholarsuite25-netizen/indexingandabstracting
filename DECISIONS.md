# DECISIONS — plain-English log of technical choices

Every entry explains **what was decided**, **why**, and **what the alternative was**. Written for a non-coder; kept short on purpose.

---

## D1 — The database enforces the rules, not the website

**Decided:** lesson locking, examination marking, the 70% gate and the 5-of-7 theory rule are enforced by PostgreSQL functions and Row Level Security (RLS).
**Why:** a determined student can edit browser tools or call the API directly. Rules inside the database cannot be bypassed by tricking the screen.
**Alternative rejected:** checking rules only in the website's buttons — easy to build, insecure.

## D2 — No ORM; plain SQL migrations + the official Supabase client

**Decided:** the schema is written as ordered SQL files under `supabase/migrations/`, and the app talks to Supabase with `@supabase/supabase-js`.
**Why:** fewer moving parts, and Supabase's security model (RLS) is designed around plain SQL. Anyone can read the schema in the Supabase dashboard.
**Alternative rejected:** Prisma/Drizzle ORM — adds a second "language" between the code and the database, which is more to learn and can hide what RLS is doing.

## D3 — Content lives in Git first, then seeds into the database

**Decided:** course content is authored as Markdown/JSON files in `/content`, imported into Supabase with `npm run db:seed`.
**Why:** every change is versioned and reversible; the database copy is what powers search, progress rules and the admin editor.
**Alternative rejected:** editing only in the database (no history), or only in Git (no search/admin editing).

## D4 — Server Components by default

**Decided:** pages render on the server and send HTML; only interactive parts (examinations, reading tracker) run JavaScript in the browser.
**Why:** much faster on slow connections and cheap phones — a big deal for the target audience.
**Alternative rejected:** a fully client-side app (heavier, slower first paint).

## D5 — Answer keys and model answers are quarantined

**Decided:** correct answers, explanations and theory model answers are never sent to a student's browser, and the supplied exam PDFs are staff-only resources.
**Why:** the supplied PDFs print questions and answers in the same file. Handing out the file would hand out the answers.
**Alternative rejected:** shipping the PDFs as ordinary course resources.

## D6 — "Exactly five" checked five times; "at least 70%" checked four times

**Decided:** each rule is verified in the user interface, in a database function, in a constraint/trigger, and in an RLS policy.
**Why:** belt and braces — one layer is convenience, the rest are security.
**Alternative rejected:** a single check (a bug there would silently break an exam rule).

## D7 — Certificates print from the browser; QR codes generate in the browser

**Decided:** the certificate is styled HTML printed to PDF by the user; the QR code is generated locally by a small open-source library.
**Why:** zero cost, no third-party API, no heavy PDF software.
**Alternative rejected:** PDF libraries or online QR services (extra dependencies, or paid/unreliable services).

## D8 — Testing runs against a real free Supabase project

**Decided:** tests create real test users against a dedicated free Supabase project (`/tests`), rather than requiring Docker locally.
**Why:** you are a non-coder on Windows; installing and running Docker is a common point of failure.
**Alternative rejected:** a fully local database stack (better for some developers, but higher setup risk here).

## D9 — Enrichment is optional, badged and non-examinable

**Decided:** extra topics (metadata, authority control, AI literacy, Nigerian case studies, etc.) are stored with `source: supplementary` and shown with a persistent label.
**Why:** your brief requires supplied material and enrichment to stay clearly separated.
**Alternative rejected:** mixing enrichment into chapters (would blur what the source actually says).

## D10 — Theory pass mark and certificate rules are configurable, not invented

**Decided:** the supplied papers do not state a theory pass mark, so the LMS uses an admin-configurable default (50/100) labelled as an LMS default.
**Why:** inventing a rule and presenting it as course policy would be academically wrong.
**Alternative rejected:** hard-coding an unsourced pass mark.

## D11 — Environment variables are validated, secrets stay on the server

**Decided:** `lib/env.ts` checks configuration at startup with friendly error messages; anything secret is guarded by the `server-only` import so it cannot be bundled into the browser code.
**Why:** a missing key should fail loudly for you, not silently for a student; a leaked key would allow database misuse.
**Alternative rejected:** discovering misconfiguration only when a page crashes for learners.

## D12 — Development-build notices instead of hidden dead ends

**Decided:** while a phase is still being built (for example, sign-in before Phase 3), the interface shows a short "Development build" note explaining what activates when.
**Why:** you always know whether something is broken or simply not built yet. All such notices are removed before final acceptance (Phase 13).
**Alternative rejected:** buttons that do nothing, or silently failing forms.

## D13 — Minimal dependency list

**Decided:** Next.js, React, Tailwind, Supabase client, Zod, Markdown renderer, icons, toasts, and testing tools. Nothing else unless a real need appears.
**Why:** every dependency is something another developer must trust and maintain; fewer is safer and cheaper.
**Alternative rejected:** UI mega-kits, state-management libraries, charting frameworks, PDF toolkits (all avoided for now).

## D14 - Admin is global, instructor is course-scoped

**Decided:** the `admin` role manages every course and platform settings; the practical day-to-day content role is a course-scoped instructor recorded in `course_staff` (no special role needed). Superadmin additionally manages roles, permissions and can revoke profiles.
**Why:** two roles instead of three keep the permission model explainable to a non-coder, while `course_staff` already gives per-course scoping for the people who actually teach.
**Alternative rejected:** course-restricted admins (needed extra bookkeeping for platform settings and produced confusing "admin but cannot see that course" states).

## D15 - Migrations are validated locally before touching the real project

**Decided:** `npm run check:sql` proves every migration against a throwaway Postgres running inside Node (PGlite) with the Supabase auth schema emulated - no Docker, no account, no cost.
**Why:** you should never watch a database error you cannot interpret; the SQL is proven before it touches your project.
**Superseded in part by D16:** *how* the proven SQL reaches the project is no longer a manual paste.

---

## D16 - Migrations reach the live project with one command, over the database's own connection

**Decided:** `npm run db:push` applies the migration files to the live project over a normal encrypted Postgres connection (Supabase's IPv4 pooler address, because the direct address is IPv6-only). `npm run db:push -- --check` inspects without changing. The one thing the owner supplies, once, is the dashboard's connection string stored as `DATABASE_URL` in `.env.local` — or, if they prefer, nothing at all and the command prompts for the password without saving it.

**Why:** pasting 4,861 lines into the SQL Editor was the single most repeated instruction in this project and the single most error-prone step for a non-coder (a truncated or re-encoded paste fails halfway). The command is re-runnable because every statement is `create or replace` / `drop ... if exists`, it prints plain-English errors with the offending migration, and it needs no new account, no paid tooling and no standing daemon.

**Alternatives rejected, and why:**
- *A service-role-callable `exec_sql` RPC.* Would let the app (and anyone who ever obtained the anon key plus a crafted request) run arbitrary DDL and read every row. A permanent backdoor was not an acceptable price for convenience.
- *A full-account Supabase personal access token.* Grants far more than a database password, including project deletion and billing. The database password is the smallest credential that does the job, and it is revocable on its own.
- *`supabase db push` CLI.* Requires a linked project, a personal access token, Docker for some commands, and more terminal steps than the owner is comfortable with. The npm script needs no global tooling.
- *Keeping the SQL Editor paste as the documented path.* Preserved only as a manual fallback; the command is the documented path.
- *Asking the owner to run DDL as a database superuser by hand each release.* Every manual run is a chance to apply the wrong file, or half of one.

**Consequence:** the owner performs one credential copy, once. Every future schema change is a command the assistant can run, and `npm run test:all` verifies the result against the real database.

---

*New decisions are appended here as they are made.*
