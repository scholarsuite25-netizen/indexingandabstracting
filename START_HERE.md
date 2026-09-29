# START HERE - LIS 815 LMS

LIS 815 LMS - the one page to follow from a blank machine to a working site, in order, with the exact commands and the exact clicks. Nothing here assumes you write code.

You will need: a Windows or Mac computer, about an hour for the first pass, a free [Supabase](https://supabase.com) account, and (for step 12 only) free GitHub and Vercel accounts.

**Rule for the whole project: no secret ever goes into a file you might share.** Secrets live in `.env.local` on your machine, and in Vercel's environment settings once the site is online. `.env.local` is ignored by git, so it is never uploaded. `SECURITY.md` explains why.

---

## Where each credential goes

| Credential | Where it lives | Where it must never go |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (your machine) and Vercel | never in code you write by hand |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` and Vercel | safe to expose; it is the public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` and Vercel **only** | never in the browser, never in git |
| `DATABASE_URL` / `SUPABASE_DB_PASSWORD` | `.env.local` only | not Vercel - your machine runs the database scripts |
| `SMTP_*` | `.env.local` (and Vercel if you want emails in production) | the password is a real app password |
| `NEXT_PUBLIC_PLAUSIBLE_*`, `NEXT_PUBLIC_SENTRY_DSN` | optional, leave empty if unused | - |

Getting a value wrong does not crash the site; it usually shows a blank sign-in page or an "Invalid API key" message. Check this table first.

---

## Step 1 - Install the two programs

1. Install **Node.js** (the LTS version) from https://nodejs.org and accept every default.
2. Install **Git** from https://git-scm.com/downloads and accept every default.

Check both worked. Open a terminal (Windows: press the Windows key, type `terminal`, press Enter) and run:

```
node --version
git --version
```

Two version numbers are the answer you want.

## Step 2 - Get the project folder

The project is the folder you are reading this file from. If you were given it as a download or a ZIP, put it somewhere plain such as `Documents\LIS815`, and make sure the folder that contains `package.json` is the one you open.

## Step 3 - Tell your terminal where Node lives (every new terminal)

Open the terminal in the project folder: in File Explorer, click into the project folder, type `terminal` in the address bar, press Enter. Then:

```
export PATH="/c/Program Files/nodejs:$PATH"
```

`NONCODER_SETUP.md` repeats this line. Put it at the top of your notes: every fresh terminal needs it, or `npm` will not be found.

## Step 4 - Install the project's packages

```
npm install
```

Once. It takes a few minutes and prints a lot. It is normal.

## Step 5 - Fill in `.env.local`

1. In the project folder, make a copy of `.env.example` and name the copy `.env.local` (same folder, same name with the `.local` on the end).
2. Open it in Notepad.
3. In the Supabase dashboard, open your project, then **Project Settings** (gear icon) **> API**:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` -> `SUPABASE_SERVICE_ROLE_KEY` (this one is powerful: server only, never in the browser)
4. Still in the dashboard: **Project Settings > Database > Database password**, click the eye icon, Copy -> paste as `SUPABASE_DB_PASSWORD`.
5. If you want email to work (password resets), fill the `SMTP_*` lines with your own Gmail address and a Google **app password** (Google Account > Security > 2-Step Verification > App passwords).
6. Leave the Plausible and Sentry lines empty unless you use them.
7. Set `NEXT_PUBLIC_APP_URL` to the address the site will really have (for now `http://localhost:3000`).

Save the file. Check your values are not wrapped in extra quotes or spaces.

## Step 6 - One-time step so you never paste SQL again

Still in the Supabase dashboard: **Project Settings > Database > Connection string > URI** (the `postgresql://...` line), Copy -> paste it into `.env.local` as `DATABASE_URL` on its own line.

From now on, every database change is one command on your machine. You never open the SQL Editor again. `NONCODER_SETUP.md`, section "One-time step so you never paste SQL again", has the same steps with pictures of the exact buttons.

## Step 7 - Put the database structure in place

```
npm run db:push -- --check
npm run db:push
```

The first command only reports what your live database already has. The second sends the migrations. Both are safe to run any number of times: it sends everything in one transaction, so a failure leaves the database exactly as it was, and it stores a fingerprint of what it sent so a second run says "already up to date".

## Step 8 - Load the course content

```
npm run db:seed
```

This loads the modules, chapters, lessons, glossary, question bank, resources and announcements from the `content/` folder. Running it twice does not duplicate anything.

## Step 9 - Run the whole gate

```
npm run test:all
```

Every suite runs in order (content files, migrations, security rules, progression, objective exam, theory exam, study tools, dashboards). The last line should read `ok` against all eight. This is the command to run after any change, and the one to run when you suspect something broke.

Individual pieces, if you want one at a time:

```
npm run lint
npm run typecheck
npm run check:content
npm run check:sql
npm run test:rls
```

## Step 10 - Use the site yourself

```
npm run dev
```

Then open http://localhost:3000 in your browser.

1. Click **Sign up** and create your account.
2. Go to `/setup/claim-superadmin` once - that makes you the platform owner. There is no password in any file; the claim happens because you are signed in and nobody else has claimed it yet.
3. Enrol in the course, read lesson 1, and try to mark it complete before you have read 90% - it should refuse.
4. Resize the window to phone width: the reader must not scroll sideways.
5. Stop the server with `Ctrl+C` in the terminal when you are done.

## Step 11 - Back up before anything risky

```
npm run db:backup
npm run db:restore -- --dry-run
```

The first writes every table to `backups/<date>/` as one JSON file per table plus a manifest. The second rehearses a restore inside a transaction and puts everything back the way it was - it is the drill you run to prove the backup is usable.

To actually put a backup back:

```
npm run db:restore -- --from <the folder name>
```

It asks you to type the folder name first. Structure and rows are separate: `npm run db:push` rebuilds tables, `npm run db:restore` puts rows into them. `DATABASE.md` covers the whole subject.

## Step 12 - Put it on the internet

Followed in order, with the exact names: `DEPLOYMENT.md`. In short:

1. Push the folder to a new GitHub repository (Git: `git add .`, `git commit -m "first"`, `git push` - or use GitHub Desktop).
2. In Vercel: **Add New > Project > Import** that repository. `vercel.json` already holds the build settings.
3. In Vercel: **Settings > Environment Variables** and add every name from the table at the top of this file, with the same values as `.env.local`.
4. Click **Deploy**, wait for the green tick, and copy the address Vercel gives you.
5. In Supabase: **Authentication > URL Configuration > Redirect URLs** - add your Vercel address (and `http://localhost:3000`). This is the step people forget; without it, sign-in silently fails.

## Step 13 - Check the live site, then know where to look

```
npm run test:smoke -- --url https://your-address.vercel.app
```

It checks the front page, that signed-out visitors are bounced away from protected pages, that a made-up certificate number reports "not found", and then runs the full signed-in learner journey against your live URL.

When something goes wrong:

| What you saw | What it means | What to do |
|---|---|---|
| `npm: command not found` | the terminal does not know Node | run the line in step 3, then try again |
| `Invalid API key` | the anon key in `.env.local` is wrong or was rotated | re-copy `anon public` from Supabase, save, rerun |
| `That is the wrong database password` | `SUPABASE_DB_PASSWORD` is stale | copy it again from Settings > Database |
| `no project to talk to` | `NEXT_PUBLIC_SUPABASE_URL` is missing | fill step 5 |
| blank sign-in page in production | Vercel is missing a variable, or step 5 of step 12 was skipped | compare Vercel's variables with `.env.local` |
| the gate fails after a change | the change itself | read the FAIL line: it names the check |

Where to look next: `README.md` for the day-to-day commands, `NONCODER_SETUP.md` for first-time setup, `DEPLOYMENT.md` for going live, `DATABASE.md` for migrations and backups, `TEST_PLAN.md` for what each test proves, `SECURITY.md` for the rules about keys, `COSTS.md` before you pay for anything, and `IMPLEMENTATION_CHECKLIST.md` for the status of the build.
