# LIS 815 LMS - The database and its commands

LIS 815 LMS - how the schema is stored, how it reaches your Supabase project, how you back the data up, and what "safe to run twice" means.

## Where the schema lives

Every database change is a numbered SQL file in `supabase/migrations/`. You never paste SQL into the Supabase dashboard; `README.md` says so directly. `DECISIONS.md` D2 records why: plain SQL files plus the official Supabase client, with no ORM in between.

`supabase/combined_migrations.sql` is generated from that folder by `scripts/combine-sql.mjs`. It is what `npm run db:push` actually sends. Do not edit it by hand; it is rebuilt from the numbered files.

## What each migration did

| File | What its own header comment says |
|---|---|
| `0001_schema.sql` | Core schema: identity, course structure, learner state, assessments, theory exam, content support, outcomes and platform tables. No RLS here: security lives in 0003. |
| `0002_functions.sql` | Server-side rules: auth bootstrap, role helpers, reading and completion calls, objective attempt lifecycle, the theory 70% gate and the exactly-5 rule, grading, certificates. |
| `0003_rls.sql` | Row Level Security: students only see their own data and course content they may access; answers, model solutions and grades never reach the client before release. |
| `0004_seed_settings.sql` | Idempotent seed: roles, permissions and the platform settings table. Values are documented defaults; the real values live in `system_settings`. |
| `0005_search.sql` | Full-text search over lessons, glossary, resources and announcements. Students only ever receive rows they could open anyway. |
| `0006_auth.sql` | One-time superadmin claim, role-change auditing, avatar storage. |
| `0007_assessment_engine.sql` | The reads and writes the assessment engine needs: marking, answer saving, the assessment centre, the 70% gate with a plain-English reason, timed attempts, results. |
| `0008_theory_exam.sql` | The 5-of-7 theory examination parts left out earlier: autosave, the exactly-5 trigger, the learner workspace, the staff grading queue, claim, grade, release, feedback. |
| `0009_study_tooling.sql` | Study tooling hardening: an examination paper is never a student resource, and a notification is written by the system and read only by its owner. |
| `0010_released_marks_only.sql` | The mark stays off the learner's row until release; a running total is no longer published after the first answer is marked. |
| `0011_reporting.sql` | Reporting calls: dashboard statistics, question analytics, admin reports and content reordering. This file carries no header comment; its first line is the first function. |
| `0012_notifications.sql` | Notification preferences and email tracking, with RLS enabled and policies written for both new tables. |
| `0013_certificate_publicity.sql` | Public certificate verification, automatic issuance when a grade is released, and revocation with a reason. |
| `0014_verify_requires_login.sql` | Verification is signed-in only: the `anon` role loses `EXECUTE` on `get_public_certificate()`. `proxy.ts` holds the page side of the same rule. |

`DATABASE_SCHEMA.md` lists the entities in design order. `ASSESSMENT_RULES.md` and `ASSESSMENT_ENGINE.md` explain the rules those tables enforce.

## Connecting and applying changes

The one manual step is a connection string. `NONCODER_SETUP.md` gives it: Supabase dashboard, gear icon, Settings, Database, the Connection string panel, copy the URI line, and add `DATABASE_URL=` plus that value to `.env.local`.

```
npm run db:push
```

- Applies every migration to your live project.
- Safe to run more than once. It compares the sha256 fingerprint of the combined file against the one stored in `system_settings` and does nothing when they match.
- Needs `SUPABASE_DB_PASSWORD` or `DATABASE_URL`. If neither is present it asks for the password and does not save it, and it never prints the password.

```
npm run db:push -- --check
```

Reports what your live database currently has and changes nothing. The same with `--dry-run` prints what would be applied.

### What "one transaction, nothing changed on failure" means

`scripts/db-push.mjs` sends the whole combined file as a single batch, with the comment "One batch, so a failure anywhere leaves the database exactly as it was." If any statement fails, the database rolls the batch back and the script prints "Nothing was changed: the whole batch was rolled back", plus the approximate line in `supabase/combined_migrations.sql` where it stopped. You are never left with half a schema.

### The sha256 fingerprint

After a successful run, `db:push` stores the sha256 of the combined file in `system_settings` under the key `schema_sql_sha256`, described as "sha256 of the last applied combined migrations". That is how the next run knows "nothing new" from "there is a new file". If writing the hash fails, the script says so and re-sending the same SQL next time is still safe.

## Backups and restores

```
npm run db:backup
```

- Writes `backups/<date>/` with one JSON file per table, plus `manifest.json` (row counts, a sha256 per file, the schema hash) and a `README.txt` you can read later.
- Keeps the newest 10 backups by default. `--keep` changes that.
- The folder is in `.gitignore` with the note that backups contain real learner rows and must never be committed.

```
npm run db:restore -- --dry-run
```

Shows exactly what a restore would do, inside a rehearsal transaction, and changes nothing. Run this first, every time.

```
npm run db:restore
```

Puts the newest backup back. `--from` picks a specific one; the script prints the exact form. A restore runs inside one transaction: either the whole thing lands, or the database is left exactly as it was.

### Structure and rows are separate

This is the important idea, and `scripts/db-backup.mjs` states it in its header:

- Structure (tables, columns, policies, functions) comes from `supabase/migrations` and is applied with `npm run db:push`.
- Rows (the actual learner records) come from `backups/` and are put back with `npm run db:restore`.

So the full recovery order after a new machine or a lost project is `npm run db:push` first, then `npm run db:restore`. A backup on its own has no tables to put rows into.

## Content rows

Course content is authored in `content/` and loaded with `npm run db:seed` (`DECISIONS.md` D3). The seeder skips rows that already exist, so re-running it never duplicates anything. `--force` overwrites admin edits, `--dry-run` prints the row plan without touching the database, and `--pglite` proves the whole seed against a throwaway local Postgres. See `CONTENT_MODEL.md`.

## Proving the schema before you touch anything real

```
npm run check:sql
```

Runs every migration against a throwaway Postgres inside Node (`DECISIONS.md` D15). No Docker, no account, no cost. It applies the numbered files twice, then applies `supabase/combined_migrations.sql` twice, to prove the second run changes nothing. `.github/workflows/ci.yml` runs it on every push with the comment "applied twice, to prove they are re-runnable".

## Related reading

`RLS.md` for the security rules, `DEPLOYMENT.md` for the live path, `TEST_PLAN.md` for the order to run the checks, and `SECURITY.md` for which keys are secrets.
