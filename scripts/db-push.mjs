#!/usr/bin/env node
// LIS 815 LMS - apply the database migrations to your live Supabase project.
//
//   npm run db:push            apply every migration (safe to run more than once)
//   npm run db:push -- --check report what the live database has, change nothing
//   npm run db:push -- --dry-run  print what would be applied, change nothing
//
// Why this exists: the migrations used to have to be copied out of a file and pasted
// into the Supabase SQL Editor by hand. That is easy to get wrong and impossible to
// undo, and it had to be repeated every time the schema changed. This script does it
// over a normal encrypted database connection instead, so it is one command, every
// time, and it reports exactly what it did.
//
// It needs the project's database password, which lives in .env.local as
// SUPABASE_DB_PASSWORD. If that is not there, the script asks for it and does NOT
// save it. The password is never printed, never logged, and never sent anywhere
// except straight to your own database.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { root, projectRef, plainReason, connect } from "./lib/db.mjs";

const combined = resolve(root, "supabase", "combined_migrations.sql");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check") || args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Reporting what the live database already has
// ---------------------------------------------------------------------------

async function report(client) {
  const probe = async (sql) => {
    const { rows } = await client.query(sql);
    return rows[0];
  };

  const tables = await probe(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  const policies = await probe(
    "select count(*)::int as n from pg_policies where schemaname = 'public'",
  );
  const column = await probe(
    "select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'theory_submissions' and column_name = 'total_words'",
  );
  const functions = await probe(
    `select count(*)::int as n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname in (
       'get_theory_workspace','get_theory_result','theory_grading_queue',
       'get_theory_grading_view','claim_theory_submission','grade_theory_answer',
       'set_theory_overall_feedback','release_theory_grade')`,
  );
  const { rows: migrations } = await client.query(
    "select version() as v, current_database() as db, current_user as usr",
  );

  const phase7 = Number(column.n) === 1 && Number(functions.n) === 8;

  // What the last successful push applied. Phase 7 markers alone cannot say that: they
  // stay true for every later migration, so a new file would silently never be sent.
  let schemaHash = null;
  try {
    const stored = await probe(
      "select value #>> '{}' as v from public.system_settings where key = 'schema_sql_sha256'",
    );
    schemaHash = stored?.v ?? null;
  } catch {
    schemaHash = null; // the table or the row is not there yet
  }

  return {
    tables: Number(tables.n),
    policies: Number(policies.n),
    totalWords: Number(column.n) === 1,
    phase7Functions: Number(functions.n),
    phase7,
    schemaHash,
    server: migrations[0].v.split(" ").slice(0, 2).join(" "),
    database: migrations[0].db,
    user: migrations[0].usr,
  };
}

function printReport(state) {
  console.log("");
  console.log("  Live database now");
  console.log(`    ${state.server} · database "${state.database}" as ${state.user}`);
  console.log(`    ${state.tables} tables, ${state.policies} row-level security policies`);
  console.log(
    `    Phase 7 theory engine: ${state.phase7 ? "installed" : "NOT installed"}${
      state.phase7 ? "" : ` (total_words ${state.totalWords ? "yes" : "no"}, ${state.phase7Functions}/8 functions)`
    }`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pg = (await import("pg")).default;

  if (!projectRef) {
    console.log("");
    console.log("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local, so there is no project to talk to.");
    console.log("Add it first:  npm run setup   (or open .env.local and fill in the three values)");
    console.log("");
    process.exit(1);
  }

  // Always rebuild the file from the migrations first, so what gets applied can never
  // drift from what is in supabase/migrations.
  const built = spawnSync(process.execPath, [resolve(root, "scripts", "combine-sql.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  if (built.status !== 0) {
    console.log(built.stdout || built.stderr || "combine-sql.mjs failed");
    process.exit(1);
  }
  const builtLine = (built.stdout || "").trim().split(/\r?\n/).pop();
  console.log("");
  console.log(`LIS 815 LMS - applying migrations to ${projectRef}`);
  if (builtLine) console.log(`  ${builtLine}`);

  const sql = readFileSync(combined, "utf8");
  const sqlHash = createHash("sha256").update(sql).digest("hex");
  const kb = Math.round(Buffer.byteLength(sql) / 1024);

  const { client, host } = await connect(pg, { applicationName: "lis815-db-push" });

  try {
    const before = await report(client);
    console.log(`  connected over ${host}`);
    printReport(before);

    if (checkOnly) {
      const pending = !(before.phase7 && before.schemaHash === sqlHash);
      console.log("");
      console.log("  Checked only. Nothing was changed.");
      console.log(
        pending
          ? "  Run  npm run db:push  (no arguments) to install the missing pieces."
          : "  Everything is up to date.",
      );
      console.log("");
      return;
    }

    if (before.phase7 && before.schemaHash === sqlHash) {
      console.log("");
      console.log("  Already up to date, so nothing needed doing.");
      console.log("  Running the same command again is harmless: every migration is written to be re-runnable.");
      console.log("");
      return;
    }

    console.log("");
    if (before.phase7) {
      console.log("  The migrations changed since the last push, so they are being sent now.");
    }
    console.log(`  Applying ${kb} KB of SQL. This can take a minute; please leave this window alone.`);
    const started = Date.now();
    try {
      // One batch, so a failure anywhere leaves the database exactly as it was.
      await client.query("set statement_timeout = 0");
      await client.query(sql);
    } catch (error) {
      const where = error.position ? Number(error.position) : null;
      console.log("");
      console.log("  Nothing was changed: the whole batch was rolled back.");
      console.log(`  The database said: ${error.message.split("\n")[0]}`);
      const reason = plainReason(error.message);
      if (reason) console.log(`  ${reason}`);
      if (where && where > 0) {
        const line = sql.slice(0, where).split("\n").length;
        const lines = sql.split("\n");
        console.log("");
        console.log(`  It happened around line ${line} of supabase/combined_migrations.sql:`);
        for (let n = Math.max(1, line - 2); n <= Math.min(lines.length, line + 2); n++) {
          console.log(`    ${n === line ? ">" : " "} ${n}: ${lines[n - 1].slice(0, 160)}`);
        }
      }
      console.log("");
      process.exit(1);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    const after = await report(client);
    console.log(`  Done in ${seconds}s.`);
    printReport(after);

    if (!after.phase7) {
      console.log("");
      console.log("  The Phase 7 functions are still not visible. Tell me and I will look into it.");
      console.log("");
      process.exit(1);
    }

    // Remember what was just sent, so the next run can tell "nothing new" from
    // "there is a new file" instead of trusting a marker that never moves.
    try {
      await client.query(
        `insert into public.system_settings (key, value, description)
         values ('schema_sql_sha256', to_jsonb($1::text), 'sha256 of the last applied combined migrations')
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [sqlHash],
      );
    } catch (error) {
      console.log("");
      console.log(`  Note: could not record the applied hash (${error.message.split("\n")[0]}).`);
      console.log("  The next push will re-send the same SQL, which is safe.");
    }

    console.log("");
    console.log("  Your database is now up to date. Nothing else to do here.");
    console.log("  Next, in this same window:");
    console.log("    npm run db:seed        (only the first time, to load the course content)");
    console.log("    npm run test:theory    (checks the whole theory exam on your real database)");
    console.log("    npm run test:assessment");
    console.log("");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("\nThat did not work:", e.message);
  console.error("Nothing was changed.");
  process.exit(1);
});
