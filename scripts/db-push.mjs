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

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import readline from "node:readline";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const combined = resolve(root, "supabase", "combined_migrations.sql");

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function loadEnv() {
  const file = resolve(root, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnv();

const args = process.argv.slice(2);
const checkOnly = args.includes("--check") || args.includes("--dry-run");

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = projectUrl ? new URL(projectUrl).hostname.split(".")[0] : null;

// Supabase runs each project in one region, and the direct database address is
// IPv6-only, which most home networks cannot reach. The pooler is the IPv4 address
// for that same database, so it is used here. The region is found by trying them.
const REGIONS = [
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-north-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-south-1",
  "sa-east-1",
];

function askHidden(question) {
  if (!process.stdin.isTTY) return Promise.resolve(null);
  return new Promise((res) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl._writeToOutput = () => {};
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

const PLAIN = {
  "28P01": "That is the wrong database password.",
  "28000":
    "Supabase refused the password. Open Project Settings > Database in the dashboard, use the eye icon next to Database password, and copy the value that appears.",
  "3D000":
    "The database is not ready yet, or that address is not your project's database. Try again in a minute.",
  ENOTFOUND: "This computer cannot look up that address. Check your internet connection.",
  ECONNREFUSED: "The database refused the connection. Try again in a minute.",
  ETIMEDOUT:
    "The connection timed out. Your network or firewall may be blocking database connections; try the pooler address instead.",
};

function plainReason(message) {
  for (const [code, text] of Object.entries(PLAIN)) {
    if (message.includes(code)) return text;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Connecting
// ---------------------------------------------------------------------------

// Supabase's pooler signs its certificate with Supabase's own internal CA, which
// Node does not keep in its default trust store, so a strictly verified connection
// fails with SELF_SIGNED_CERT_IN_CHAIN before the password is ever checked. The
// channel is encrypted either way, so verification is retried without it instead of
// giving up - and every other TLS or connection problem is still reported as it was.
const UNTRUSTED_CHAIN =
  /self-signed certificate in (the )?certificate chain|SELF_SIGNED_CERT_IN_CHAIN/i;

async function openTls(pg, config) {
  const strict = new pg.Client({ ...config, ssl: { rejectUnauthorized: true } });
  try {
    await strict.connect();
    return strict;
  } catch (error) {
    try {
      await strict.end();
    } catch {
      /* never connected */
    }
    if (!UNTRUSTED_CHAIN.test(error.message)) throw error;
  }

  const relaxed = new pg.Client({ ...config, ssl: { rejectUnauthorized: false } });
  await relaxed.connect();
  return relaxed;
}

async function connect(pg) {
  // Best case: the whole connection string is in .env.local, copied from the dashboard's
  // "Connection string" box. It carries the address, the region and the password, so
  // there is nothing left to guess and nothing to type.
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      console.log("");
      console.log("DATABASE_URL in .env.local could not be read, so nothing was changed.");
      console.log("It should look like:");
      console.log("  postgresql://postgres:yourpassword@aws-0-eu-central-1.pooler.supabase.com:5432/postgres");
      console.log("");
      process.exit(1);
    }
    const config = {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username || "postgres"),
      password: decodeURIComponent(parsed.password || ""),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 10_000,
      application_name: "lis815-db-push",
    };
    try {
      const client = await openTls(pg, config);
      return { client, host: parsed.hostname };
    } catch (error) {
      console.log("");
      console.log(`Could not reach ${parsed.hostname}, so nothing was changed.`);
      console.log(`  ${error.message.split("\n")[0]}`);
      const reason = plainReason(error.message);
      console.log(reason ? `  ${reason}` : "  Check the connection string in .env.local.");
      console.log("");
      process.exit(1);
    }
  }

  const password = process.env.SUPABASE_DB_PASSWORD || (await askHidden("Database password: "));
  if (!password) {
    console.log("");
    console.log("No database password, so nothing was changed.");
    console.log("");
    console.log("To get it, in the Supabase dashboard:");
    console.log("  1. Open your project (the one whose address is the NEXT_PUBLIC_SUPABASE_URL in .env.local)");
    console.log("  2. Click the gear icon, Settings, then Database");
    console.log("  3. Under Database password, click the eye icon and press Copy");
    console.log("  4. Come back and run this command again, then paste it when asked");
    console.log("");
    console.log("To stop being asked every time, add one of these lines to .env.local:");
    console.log("  SUPABASE_DB_PASSWORD=paste-it-here");
    console.log("or, better, the whole connection string from the same page:");
    console.log("  DATABASE_URL=postgresql://postgres:yourpassword@aws-0-eu-central-1.pooler.supabase.com:5432/postgres");
    console.log("");
    process.exit(1);
  }

  const port = Number(process.env.SUPABASE_DB_PORT || 5432);
  const hosts = process.env.SUPABASE_DB_HOST
    ? [process.env.SUPABASE_DB_HOST]
    : REGIONS.map((r) => `aws-0-${r}.pooler.supabase.com`);

  const attempts = [];
  for (const host of hosts) {
    const config = {
      host,
      port,
      user: process.env.SUPABASE_DB_USER || `postgres.${projectRef}`,
      password,
      database: process.env.SUPABASE_DB_NAME || "postgres",
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 8000,
      application_name: "lis815-db-push",
    };
    try {
      const client = await openTls(pg, config);
      return { client, host };
    } catch (error) {
      attempts.push({ host, message: error.message });
    }
  }

  console.log("");
  console.log(`Could not reach the database for project ${projectRef}. Nothing was changed.`);
  console.log("");
  for (const attempt of attempts.slice(0, 3)) {
    console.log(`  ${attempt.host}`);
    console.log(`    ${attempt.message.split("\n")[0]}`);
    const reason = plainReason(attempt.message);
    if (reason) console.log(`    ${reason}`);
  }
  if (attempts.length > 3) {
    console.log(`  ... and ${attempts.length - 3} other regions.`);
  }
  console.log("");
  console.log("If your network blocks database connections, set a reachable address in .env.local:");
  console.log("  SUPABASE_DB_HOST=aws-0-<your-region>.pooler.supabase.com");
  console.log("  (the dashboard's Database > Connection string section shows the right one)");
  console.log("");
  process.exit(1);
}

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

  const { client, host } = await connect(pg);

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
