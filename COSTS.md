# LIS 815 LMS - What is free, what could cost money

LIS 815 LMS - a plain-English note on money: the project is built to run at zero cost, and no figure here should be treated as a promise.

## What the repo already says

- `ARCHITECTURE.md` calls this a "zero-cost-first" system and says "No paid third-party service is required for core LMS operation".
- `README.md` says the intended hosting is the Vercel free tier.
- `NONCODER_SETUP.md`, section "Cost discipline": avoid paid email, analytics, search, AI and storage providers unless explicitly enabled later.
- `OPENCODE_MASTER_PROMPT.md` asks for this file by name and says: never promise perpetual zero cost, because third-party pricing and usage limits change.
- `BUILD_PLAN.md` section 18 says every figure it lists is *indicative* and must be re-checked at the vendors' own pricing pages and recorded in this file.
- `BUILD_PLAN.md` also says plainly that "zero cost cannot be promised forever".

Nothing in this repo states a price in money. This file does not either.

## Things the repo does deliberately so you stay on the free tier

- Certificates are printed from the browser and QR codes are generated in the browser. `DECISIONS.md` D7 gives the reason: no PDF library, no paid QR service.
- Search runs on PostgreSQL full-text search inside the database. `BUILD_PLAN.md` section 14 says "no paid search service".
- Course materials are text-first pages with self-hosted fonts, so there is no CDN or media bill behind them (`BUILD_PLAN.md` section 15).
- Backups are JSON files on your own disk in `backups/`, not a paid backup product.
- The dependency list is kept small on purpose. `DECISIONS.md` D13: every dependency is something else to trust, maintain and pay for later.
- Edge Functions are not used at all in the current build, which `BUILD_PLAN.md` says keeps the free-tier footprint small.

If you later add a paid service, add a row to the table above and a sentence to this section saying who asked for it and what it replaced.

## Indicative allowances, quoted from `BUILD_PLAN.md` section 18

These are the figures the repo itself wrote down. They are not verified here. Confirm each one on the vendor's own pricing page before you rely on it.

| Service | Tier | Used for | Indicative free limits (repo's words) | Could cost if... |
|---|---|---|---|---|
| Supabase | Free | Postgres, Auth, Storage, Edge Functions | about 500 MB database, about 50k monthly active users, about 1 GB storage; project pauses after about 7 days of inactivity | data grows past the allowance, heavy egress, or you need point-in-time recovery backups |
| Vercel | Hobby | Hosting, HTTPS, previews, cron | about 100 GB bandwidth per month; non-commercial use only | commercial use, high traffic, team features |
| GitHub | Free | Source, CI minutes (2,000 per month) | unlimited public and private repos | larger teams or more Actions minutes |
| Email | Supabase built-in | Confirmations, resets | about 2 to 3 emails per hour | higher volume, then free Gmail SMTP or a paid provider |
| AI APIs | optional | off by default, never required | not applicable | only if you deliberately switch them on |

## What is free in this repo right now

- Everything you run on your own machine: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm run typecheck`.
- `npm run check:content` reads local files only. It needs no account and no key.
- `npm run check:sql` runs the migrations against a throwaway Postgres inside Node (`DECISIONS.md` D15). No Docker, no account, no cost.
- A Supabase project on its free tier, for the keys in `.env.local`.
- The GitHub Actions workflow in `.github/workflows/ci.yml`. Its `quality` job needs no secrets at all. Actions minutes are billed by GitHub, so check the allowance above against your own usage.

## What would start costing money

1. **Leaving the free tier.** A paid plan starts when you exceed an allowance or ask for a paid feature. The repo lists the triggers above. It does not list any paid-plan price. To confirm.
2. **A custom domain name.** The repo assumes a Vercel-provided address and does not document domain prices. To confirm on the vendor's pricing page.
3. **Outbound email volume.** `.env.example` marks the Gmail SMTP block as "Required for emails". `BUILD_PLAN.md` gives the built-in Supabase allowance as indicative, then points at a free Gmail SMTP route or a paid provider. No price is stated in the repo. To confirm.
4. **Optional services in `.env.example`.** Plausible analytics, Sentry error monitoring and AI APIs are optional and off unless you fill them in. `BUILD_PLAN.md` says AI APIs are never required.
5. **Storage growth.** Uploaded files and images count against the storage allowance. `BUILD_PLAN.md` notes that reading events are pruned after 180 days to protect the database budget.

## How to avoid a surprise bill

- Stay on the free tier. Do not press "upgrade" unless you have decided the cost is worth it.
- Set a spending or usage alert in the Vercel, Supabase and GitHub dashboards. The repo does not document these clicks. To confirm in each vendor's own documentation.
- Keep keys out of the repository. `SECURITY.md` says `SUPABASE_SERVICE_ROLE_KEY` is a critical secret that bypasses all RLS. `.env.local` is ignored by git.
- If a key leaks, rotate it in the Supabase dashboard, then paste the new value into `.env.local` and into Vercel's environment variables. The repo documents where keys live, not the rotation clicks. To confirm.
- Do not enable paid email, analytics, search, AI or storage providers, per `NONCODER_SETUP.md`.
- Take a local backup before any risky change: `npm run db:backup` writes JSON files into `backups/` on your own machine. That costs nothing.

## What this repo does not state

- Any current price, limit or free-tier term. All of that lives with the vendors.
- Steps for setting spending alerts.
- Whether you will need a paid plan for your own class size. Content is small; `BUILD_PLAN.md` calls free-tier limit changes a risk and points back to this file.
- `START_HERE.md` is referenced in `IMPLEMENTATION_CHECKLIST.md` as a Phase 14 deliverable. It is not in this repository yet.

## A simple check you can do each term

Once a term, before classes start, look at these four places and write the date in this file:

1. Your Vercel dashboard: which plan you are on, and any usage warning shown there.
2. Your Supabase dashboard: which plan you are on, and whether the project has paused for inactivity. `BUILD_PLAN.md` gives about 7 days of inactivity as the indicative pause, and says to log in weekly. Confirm the current rule.
3. Your GitHub billing page: Actions minutes used this month.
4. `.env.example` against your real `.env.local`: nothing new has appeared that switches on a paid service.

None of those four steps is written down as clicks anywhere in this repository. To confirm on each vendor's own documentation.

## Where to write down what you find

Update this file when you confirm a figure. Write the date next to it. The point of this file is that the next maintainer can see what you checked and when, instead of trusting an old number.
