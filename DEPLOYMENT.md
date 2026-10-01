# LIS 815 LMS - Putting the site live

LIS 815 LMS - the documented route from a local project to a live URL, and what to do after a schema change.

## What you need first

- A GitHub account. `NONCODER_SETUP.md` says a free account is enough.
- A Supabase project, with its URL and keys in `.env.local` (see `.env.example`).
- A Vercel account, if you deploy there. `NONCODER_SETUP.md` lists it as optional until you use it.
- `DATABASE_URL` in `.env.local`, copied once from the Supabase dashboard. `NONCODER_SETUP.md`, section "One-time step so you never paste SQL again", gives the exact click path: Settings, then Database, then the Connection string URI line. If you skip that line, `npm run db:push` will ask for the password instead of saving it.

## The deployment path the repo documents

`README.md`, `NONCODER_SETUP.md` and `IMPLEMENTATION_CHECKLIST.md` (Phase 14) all describe the same route:

1. Push the project to GitHub.
2. In Vercel, import the repository.
3. Vercel detects Next.js from `vercel.json`. That file sets `buildCommand` to `npm run build` and `installCommand` to `npm install`.
4. Add the environment variables, using the exact names below.
5. Click Deploy.
6. In Supabase, open **Auth**, then **URL Configuration**, and add the Vercel domain. `NONCODER_SETUP.md` and `BUILD_PLAN.md` section 20 both say this is the step people forget.

## Environment variables, by exact name

These are the names in `.env.example`. Copy the names exactly; a typo shows up as a broken sign-in page, not as an error.

| Name | What `.env.example` says |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (Required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (Required) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (Required) |
| `SUPABASE_DB_PASSWORD` | Supabase (Required) |
| `DATABASE_URL` | Supabase (Required) |
| `SMTP_HOST` | Gmail SMTP (Required for emails) |
| `SMTP_PORT` | Gmail SMTP (Required for emails) |
| `SMTP_SECURE` | Gmail SMTP (Required for emails) |
| `SMTP_USER` | Gmail SMTP (Required for emails) |
| `SMTP_PASSWORD` | Gmail SMTP (Required for emails) |
| `SMTP_FROM` | Gmail SMTP (Required for emails) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible Analytics (Optional) |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` | Plausible Analytics (Optional) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry Error Monitoring (Optional) |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Sentry Error Monitoring (Optional) |
| `NEXT_PUBLIC_APP_URL` | App Configuration |
| `NEXT_PUBLIC_APP_NAME` | App Configuration |

Notes you can check yourself:

- `README.md` names `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the minimum for Vercel. `BUILD_PLAN.md` section 20.3 adds `SUPABASE_SERVICE_ROLE_KEY`, marked server-only.
- `SECURITY.md` says the anon key is safe to expose and the service-role key is not. Paste the service-role key into Vercel only, never into client code and never into git.
- `lib/env.ts` checks the three Supabase values at startup and fails with a readable message. It does not check the SMTP, Plausible or Sentry names.
- Which variables belong in Vercel versus only in your local `.env.local`, confirmed on 29 Sep 2026: Vercel needs the three Supabase values, the six `SMTP_*` names (the email system reads them at send time, and `/api/health` reports `email: configured` only when all six are present), and `NEXT_PUBLIC_APP_URL` (the links inside emails are built from it, so a missing value produces relative links that do nothing in an inbox). `DATABASE_URL` and `SUPABASE_DB_PASSWORD` stay local — only the database scripts on your own machine use them. Plausible and Sentry names stay unset until those services are switched on.

## Putting the SMTP keys into Vercel

The six `SMTP_*` values live in `.env.local`, which is git-ignored on purpose: this repository is public, so they must never be committed. The Vercel CLI sets them instead (install it with `npm install -g vercel`, then sign in with `vercel login`):

```
vercel link --project indexingandabstracting
vercel env add SMTP_HOST production
vercel env add SMTP_PORT production
vercel env add SMTP_SECURE production
vercel env add SMTP_USER production
vercel env add SMTP_PASSWORD production
vercel env add SMTP_FROM production
```

Each command waits for the value; paste the line from `.env.local` and press Enter. `vercel env ls production` lists the names it has without printing the values. The values are then taken from the file itself, so nothing is typed twice:

```powershell
$map = @{}; Get-Content .env.local | ForEach-Object { if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') { $map[$Matches[1]] = $Matches[2].Trim() } }
$map['SMTP_HOST'] | vercel env add SMTP_HOST production   # repeat for the other five
```

Two things to expect: `vercel link` writes a `VERCEL_OIDC_TOKEN` line into `.env.local` and adds `.vercel/` to `.gitignore` (both normal, and `.env.local` stays ignored), and `NEXT_PUBLIC_` variables only reach the site on the next deploy — environment variables are read when the build runs, not on every request.

## Keeping email out of the spam folder

Everything below is about Gmail's two sending paths — the app's six `SMTP_*` settings and the custom SMTP configured on the **Supabase dashboard** (Auth sends the password-reset mail) — and about what can and cannot be guaranteed from this side of the wire.

**What the code guarantees (checked 1 Oct 2026):**

- **The technical authentication passes.** Mail leaves as `ESUT Library <esutlibrary@gmail.com>` through `smtp.gmail.com:587`, so Gmail signs it itself: `gmail.com` SPF (`v=spf1 redirect=_spf.google.com`) and DMARC (`p=none`) both pass, and the DKIM key lives at `google._domainkey.gmail.com`. Nothing here can be forged into a fail by the code, because Google does the signing.
- **The message identity matches the sender.** Every message carries its own `Message-ID` on the site's domain (`@indexingandabstracting.vercel.app`) instead of a hosting container's hostname, and an optional `SMTP_REPLY_TO` (unset by default) can point the replies elsewhere.
- **The plain-text half keeps the links.** `sendEmail` builds the text part from the HTML *before* stripping tags, so each link appears as `label (https://…)`, and the text and HTML versions therefore say the same thing.
- **Every send attempt is recorded** in the `email_log` table (`to`, `subject`, `template_type`, `sent`/`failed`, error text, message id), and `/api/health` reports the newest attempt's status as `checks.email.lastAttempt` — so "did that email go out?" is a question with an answer.
- **There is a test button.** The admin dashboard's **Email test** card sends the real welcome template to any address you type; administrators only (`is_admin()`), and the outcome appears in the card.

**What only a human with an inbox can do:**

1. Open `/admin`, put your own address in **Email test**, press the button, and look where it lands.
2. If the first message is in **Spam**, mark it *Not spam* once and reply or star it — Gmail learns from that single action far more than any header can influence, and the follow-ups arrive in the inbox. Repeat once per mailbox that matters (each recipient provider filters on its own history).
3. Test the **Supabase** path separately: `/login` → *Forgot password*. That mail is sent by Supabase Auth through the custom SMTP on the dashboard, not by this code, so it needs its own inbox check.
4. Never send a test to a list. The sending account is a consumer Gmail address: its daily limit is 500 messages, and its reputation is shared by everything sent through it.

**Honest limits:** no code change can *guarantee* inbox placement for every recipient — filters weigh engagement and the recipient provider's own history, which live outside this repository. What is guaranteed is that authentication passes, the content and structure are clean, every attempt is logged, and a single *Not spam* click trains the one mailbox that matters. If the course grows past a few hundred learners a day, or guaranteed placement starts to matter commercially, the next step is a **custom domain** (SPF + DKIM + DMARC under your own domain, plus Gmail Postmaster Tools) — that is a dashboard/DNS job, not a code change, and `COSTS.md` is where the trade-offs live.

## Building and running

On your machine:

```
npm run build
npm run start
```

`npm run build` is the production build and must pass with zero errors. `npm run start` serves what it produced. Use `npm run dev` only while developing; it is not the production server.

On Vercel the build runs from `vercel.json`, so you do not type anything.

## After any schema change

1. Add a new numbered file under `supabase/migrations/`, for example `0014_your_change.sql`.
2. Prove it locally first:

```
npm run check:sql
```

3. Apply it to the live project:

```
npm run db:push
```

`npm run db:push` is safe to run more than once. It remembers what it sent by storing a sha256 fingerprint in `system_settings` (see `DATABASE.md`). Nothing in this repo runs migrations automatically during a deploy; `BUILD_PLAN.md` section 20.2 says the migration step stays explicit and reviewed.

4. Confirm what the database now has, without changing anything:

```
npm run db:push -- --check
```

5. If you added course content rather than schema, load it with `npm run db:seed`.

## Rolling back data

A migration changes structure. A backup restores rows. They are separate, and `scripts/db-backup.mjs` says so in its header.

Always rehearse first:

```
npm run db:restore -- --dry-run
```

That prints exactly what a restore would do and changes nothing. Then run the restore:

```
npm run db:restore
```

Use `npm run db:restore -- --from <date>` to pick an older backup. The script prints the exact form. A restore runs inside one transaction: if anything fails, nothing is kept.

If the structure itself is wrong, fix the migration files and run `npm run db:push` again. Structure comes from `supabase/migrations`, rows come from `backups/`.

## After it is live

```
npm run test:smoke -- --url https://your-deployment-address
```

`scripts/smoke-test.mjs` checks the front page, that signed-out visitors are bounced away from protected pages (including `/verify/[number]`, which requires a sign-in), and then runs the signed-in learner journey against that URL — including the made-up certificate number saying "not found". See `TEST_PLAN.md`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request. The `quality` job always runs `npm run lint`, `npm run typecheck`, `npm run check:content` and `npm run check:sql`. The `live` job runs `npm run db:push -- --check` and `npm run test:all`, and only when the three Supabase values are set as repository secrets.

## Things not to assume

- `package.json` has no `engines` field, no `.nvmrc` and no `.node-version`. Continuous integration pins Node 22 in `ci.yml`. Which Node version Vercel will use is not stated in this repo. To confirm.
- `BUILD_PLAN.md` mentions `npm run db:migrate` and `npm run db:migrate:prod`. Those scripts do not exist in `package.json`. The real command is `npm run db:push`.
- `START_HERE.md` is referenced in `IMPLEMENTATION_CHECKLIST.md` but is not in this repository yet.
- `COSTS.md` has not confirmed any Vercel or Supabase limit. Read it before you add a custom domain or turn on email.
