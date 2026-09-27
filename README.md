# LIS 815 Indexing and Abstracting LMS — OpenCode Starter Package

This package is a zero-cost-oriented starter specification and source-material bundle for building a rich LMS with OpenCode, Next.js and Supabase.

## Source materials
- Indexing and Abstracting Complete Ebook
- LIS 815 Objective Examination
- LIS 815 Theory Examination

## Intended stack
- Next.js + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Auth + Postgres + Row Level Security
- Vercel free tier for deployment

## Build sequence
1. Open this folder in OpenCode.
2. Read `OPENCODE_MASTER_PROMPT.md` completely.
3. Read the three PDFs in `docs/` and treat them as authoritative course sources.
4. Build in phases; run tests after every phase.
5. Configure Supabase using `.env.local` based on `.env.example`.
6. Never expose Supabase service-role credentials in the browser.

## Important assessment rule
A learner must complete each lesson/section before the next is unlocked. The objective assessment is 100 MCQs. A score of 70% or higher unlocks the theory examination. The theory examination has 7 questions; the learner answers exactly 5.

## Deployment to Vercel
1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com/) and import the repository.
3. Vercel will automatically detect the Next.js framework using the provided `vercel.json`.
4. In the Environment Variables section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**.

## Day-to-day commands
There is no SQL to paste into the Supabase dashboard any more.

| Command | What it does |
|---|---|
| `npm run db:push` | Applies every database change to your live Supabase project. Safe to run more than once. Needs `DATABASE_URL` in `.env.local` once (see `NONCODER_SETUP.md`); after that it is one command forever, and it remembers what it already sent, so a new change is picked up on the next run. |
| `npm run db:push -- --check` | Reports what your live database currently has, and changes nothing. |
| `npm run db:seed` | Loads the course content (idempotent; only needed the first time). |
| `npm run test:all` | Runs every check in order, ending with a pass/fail summary against the real database. A check that fails only because the connection dropped (`fetch failed`) is retried; one that fails on its own assertions is not. |
| `npm run dev` | Starts the app on <http://localhost:3000>. |
| `npm run build` | Production build. |
