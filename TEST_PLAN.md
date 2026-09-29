# LIS 815 LMS - What to run before you release

LIS 815 LMS - every check in `package.json`, what each one proves, what it needs, the order to run them, and what stays manual.

## The rules of the gate

- Only commands that exist in `package.json` are listed here. If a document shows you a command that is not in this table, it is out of date.
- A check that needs no keys must never fail "because the keys are missing". That is why `.github/workflows/ci.yml` splits into a `quality` job and a `live` job.
- Run them from the project folder, in this order, and stop at the first red one.

## The table

| Command | What it proves | What it needs |
|---|---|---|
| `npm run lint` | the code passes the project's ESLint rules | nothing but installed packages |
| `npm run typecheck` | TypeScript compiles with no errors (`tsc --noEmit`) | nothing but installed packages |
| `npm run check:content` | the course files are complete, correctly shaped, labelled and faithful to the extracted PDFs | repository files only, including `docs/extracted/` |
| `npm run check:sql` | every migration applies, applies a second time, and the combined file does the same, on a throwaway Postgres inside Node | nothing. No Docker, no Supabase account, no keys (`DECISIONS.md` D15) |
| `npm run test:rls` | the row-level security policies do what they say: what a learner can see, what they cannot, what staff can write | the three Supabase keys in `.env.local`, migrations applied |
| `npm run test:progress` | enrolment, reading thresholds, lesson unlocking, knowledge-check gating and the progress roll-up | the three keys, seeded course |
| `npm run test:assessment` | the objective paper: starting early is refused, answers save and replace, `is_correct` cannot be written, timed-out attempts still score, the gate flips at the threshold | the three keys, seeded course |
| `npm run test:theory` | the theory paper: four and six refused, five accepted, no model answer in the learner workspace, autosave, grading, release | the three keys, seeded course |
| `npm run test:tooling` | glossary search, notes and bookmarks, and that one learner cannot read another's notes | the three keys, seeded course |
| `npm run test:dashboards` | dashboard numbers reconcile with hand-counted database rows | the three keys, seeded course |
| `npm run test:pages` | the real pages render for a signed-in learner: dashboard, reader, locked lessons, study tools, downloads, and that an exam paper is never served | a production server already running (`npm run build` then `npm run start`), the three keys, `npm run db:seed` |
| `npm run test:smoke` | the deployed site itself: front page is real, signed-out visitors are bounced, a made-up certificate number says "not found", then the full learner journey on that URL | a running site address (`--url` or `SMOKE_BASE_URL`), the three keys |
| `npm run test:all` | the whole automated gate in order, with a single pass/fail summary | everything the eight suites below need |

`npm run test:all` runs these eight, in this order, and stops at the first real failure: `check:content`, `check:sql`, `test:rls`, `test:progress`, `test:assessment`, `test:theory`, `test:tooling`, `test:dashboards`. A suite that fails only because the connection dropped (`fetch failed` and friends) is retried; a suite that fails on its own assertions is not (`scripts/test-all.mjs`).

Note what `test:all` does **not** include: `lint`, `typecheck`, `build`, `test:pages` and `test:smoke`. Run those yourself.

## The release order

```
npm run lint
npm run typecheck
npm run check:content
npm run check:sql
npm run build
npm run test:all
```

Then, if you have a deployed address:

```
npm run test:smoke -- --url https://your-deployment-address
```

What each step is for: the first two protect the code, the next two protect the content and the schema, `build` proves the site can be produced at all, and `test:all` proves the rules against your real database.

`.github/workflows/ci.yml` mirrors this: the `quality` job runs `lint`, `typecheck`, `check:content` and `check:sql` on every push and pull request with no secrets; the `live` job runs `npm run db:push -- --check` and `npm run test:all`, and only when the three Supabase values are configured as repository secrets.

## Commands that are not part of the gate

| Command | What it does |
|---|---|
| `npm run dev` | local development server on port 3000 |
| `npm run start` | serves the production build |
| `npm run db:push` | applies migrations to the live project (`-- --check` to inspect only) |
| `npm run db:seed` | loads the course content, idempotently |
| `npm run db:backup` / `npm run db:restore` | takes a backup / puts rows back (`-- --dry-run` first) |

Helpers that exist as files but are not npm scripts: `scripts/combine-sql.mjs` rebuilds the combined migration file, `scripts/create-superadmin.mjs` is a bootstrap helper that uses the service-role key, `scripts/test-login.mjs` tries a sign-in, and `scripts/generate-icons.mjs` makes icons. They are not part of any release order.

## What stays manual

No script in this repository does these. They come from `QA_ACCEPTANCE.md`, `IMPLEMENTATION_CHECKLIST.md` Phases 12 to 14, and `BUILD_PLAN.md` section 19.

- **Visual check.** Pages look right: layout, spacing, fonts, contrast. Two visual checks are still marked open for Phase 1, and one for Phase 5 in the checklist.
- **Phone width.** The examination is usable at 360px, and a mid-exam connection drop loses nothing.
- **Accessibility.** A keyboard-only pass of the whole journey (enrol, read, complete, answer, submit, no mouse), clear focus states, labelled controls, and the axe-core scan showing no serious or critical violations.
- **The acceptance journey.** `QA_ACCEPTANCE.md` lists it as a walk-through: register, enrol, locked lesson refuses a direct URL, reading threshold, objective score, 69% does not unlock and 70% does, exactly 5 of 7 and no more or fewer, grading and release, certificate, public verification.
- **Content decisions.** Read `content/ISSUES.md` and decide each logged ambiguity yourself.
- **Your own trial run.** Walk the course as a student on your phone and sign off.

## If a check fails

1. Read the printed name of the failing case. Every suite prints one line per case and a summary at the end.
2. For content failures, `content/FORMAT.md` and `CONTENT_MODEL.md` explain the shape the file must have.
3. For schema failures, `npm run check:sql` prints the offending migration and line before it ever touches your project.
4. For connection failures, wait and re-run: `test:all` already retries the network ones twice before it calls the run red.
5. Only after the checks are green should you deploy. `DEPLOYMENT.md` has the order.

## Related reading

`DATABASE.md` for what `db:push` and the backups do, `RLS.md` for what `test:rls` is proving, `ASSESSMENT_ENGINE.md` for what the exam suites prove, and `IMPLEMENTATION_CHECKLIST.md` for the phase-by-phase gates.
