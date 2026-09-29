#!/usr/bin/env node
// LIS 815 LMS - take a backup of the live database, and put one back.
//
//   npm run db:backup                      back up every table into backups/<date>/
//   npm run db:restore -- --dry-run        show exactly what a restore would do, change nothing
//   npm run db:restore                     put the newest backup back
//   npm run db:restore -- --from 2026-...  put a specific backup back
//
// Why this exists: Supabase keeps its own automatic backups, but those are for the
// whole project and only a support ticket can use them. This is a second, readable
// copy you can take before any risky change: one JSON file per table, plus a manifest
// that says how many rows each file holds and which migrations were installed.
//
// What it does NOT copy: the table structure itself. The structure lives in
// supabase/migrations and is recreated with `npm run db:push`. So the full recovery
// order is: db:push (structure) then db:restore (rows).
//
// Passwords are never printed. A restore runs inside one transaction: either the
// whole thing lands, or the database is left exactly as it was.

import {
  mkdirSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import readline from "node:readline";

import { root, projectRef, plainReason, connect } from "./lib/db.mjs";

const BACKUPS = resolve(root, "backups");
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

const restoreMode = has("--restore");
const dryRun = has("--dry-run");
const assumeYes = has("--yes");
const keep = Math.max(1, Number(valueOf("--keep")) || 10);

const safeName = (n) => /^[a-z_][a-z0-9_]*$/.test(n);

function ask(question) {
  if (!process.stdin.isTTY) return Promise.resolve(null);
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

async function listTables(client) {
  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return rows.map((r) => r.table_name).filter(safeName);
}

// Children before parents when deleting, parents before children when inserting.
function orderTables(tables, edges) {
  const remaining = new Set(tables);
  const ordered = [];
  const hasParent = (t) =>
    edges.some((e) => e.child === t && e.parent !== t && remaining.has(e.parent));

  while (remaining.size) {
    const ready = [...remaining]
      .filter((t) => !hasParent(t))
      .sort((a, b) => a.localeCompare(b));
    if (!ready.length) {
      // Circular references are unusual; fall back to alphabetical and let the
      // database be the judge during the restore itself.
      ordered.push(...[...remaining].sort((a, b) => a.localeCompare(b)));
      break;
    }
    for (const t of ready) {
      ordered.push(t);
      remaining.delete(t);
    }
  }
  return ordered;
}

async function foreignKeys(client) {
  const { rows } = await client.query(
    `select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
     from pg_constraint c
     where c.contype = 'f'
       and c.connamespace = 'public'::regnamespace`,
  );
  return rows.map((r) => ({
    child: r.child.replace(/^public\./, ""),
    parent: r.parent.replace(/^public\./, ""),
  }));
}

async function appliedHash(client) {
  try {
    const { rows } = await client.query(
      "select value #>> '{}' as v from public.system_settings where key = 'schema_sql_sha256'",
    );
    return rows[0]?.v ?? null;
  } catch {
    return null;
  }
}

function report(error) {
  console.log("");
  console.log(`  ${error.message.split("\n")[0]}`);
  const reason = plainReason(error.message);
  if (reason) console.log(`  ${reason}`);
  console.log("");
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

async function runBackup(client) {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const dir = join(BACKUPS, stamp);
  mkdirSync(join(dir, "tables"), { recursive: true });

  const meta = await client.query(
    "select current_database() as db, current_user as usr, version() as v",
  );
  const schemaHash = await appliedHash(client);
  const tables = await listTables(client);
  const edges = await foreignKeys(client);

  console.log("");
  console.log(`LIS 815 LMS - backing up ${projectRef || meta.rows[0].db}`);
  console.log(`  writing to backups/${stamp}`);
  if (schemaHash) console.log(`  schema: combined migrations sha256 ${schemaHash.slice(0, 16)}...`);

  const manifest = {
    project: projectRef,
    takenAt: new Date().toISOString(),
    database: meta.rows[0].db,
    server: meta.rows[0].v.split(" ").slice(0, 2).join(" "),
    schemaSqlSha256: schemaHash,
    restoreOrder: orderTables(tables, edges),
    tables: [],
    rows: 0,
  };

  let totalRows = 0;
  for (const name of tables) {
    const count = await client.query(`select count(*)::int as n from public.${name}`);
    const n = Number(count.rows[0].n);
    const { rows } = await client.query(
      `select coalesce(json_agg(to_jsonb(t)), '[]'::json) as j from public.${name} t`,
    );
    // The driver parses a json column into a value already, so it is written back out.
    const text =
      typeof rows[0].j === "string" ? rows[0].j : JSON.stringify(rows[0].j);
    const file = join("tables", `${name}.json`);
    writeFileSync(join(dir, file), text, "utf8");
    const sha = createHash("sha256").update(text).digest("hex");
    manifest.tables.push({ name, rows: n, file, sha256: sha });
    totalRows += n;
    process.stdout.write(`  ${String(n).padStart(6)} rows  ${name}\n`);
  }
  manifest.rows = totalRows;

  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(join(dir, "README.txt"), readme(stamp, manifest), "utf8");

  console.log("");
  console.log(`  Done: ${tables.length} tables, ${totalRows} rows.`);
  console.log("");
  console.log("  To prove the backup works, run a dry run:");
  console.log(`    npm run db:restore -- --from ${stamp} --dry-run`);
  console.log("  It reads every file, checks the row counts, and changes nothing.");
  console.log("");

  pruneOldBackups();
}

function readme(stamp, manifest) {
  return [
    "LIS 815 LMS - database backup",
    `taken:    ${manifest.takenAt}`,
    `project:  ${manifest.project || "unknown"}`,
    `database: ${manifest.database} (${manifest.server})`,
    `rows:     ${manifest.rows} across ${manifest.tables.length} tables`,
    `schema:   ${
      manifest.schemaSqlSha256
        ? `combined migrations sha256 ${manifest.schemaSqlSha256}`
        : "not recorded (run npm run db:push once and back up again)"
    }`,
    "",
    "HOW TO PUT THIS BACK",
    "  1. Open a terminal in the project folder.",
    "  2. npm run db:restore -- --dry-run     see the plan, change nothing.",
    "  3. npm run db:restore -- --from " + stamp + " --yes",
    "",
    "IF THE TABLES DO NOT EXIST AT ALL",
    "  npm run db:push      (rebuilds the structure)",
    "  npm run db:restore -- --from " + stamp,
    "",
    "A restore runs in one transaction: if anything fails, nothing is kept.",
    "",
  ].join("\n");
}

function pruneOldBackups() {
  if (!existsSync(BACKUPS)) return;
  const folders = readdirSync(BACKUPS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(BACKUPS, e.name, "manifest.json")))
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const name of folders.slice(keep)) {
    rmSync(join(BACKUPS, name), { recursive: true, force: true });
    console.log(`  removed older backup ${name} (keeping the newest ${keep})`);
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

async function runRestore(client) {
  const from = valueOf("--from") || latestBackup();
  if (!from) {
    console.log("");
    console.log("No backup found in backups/, so there is nothing to restore.");
    console.log("Take one first:  npm run db:backup");
    console.log("");
    process.exit(1);
  }
  const dir = resolve(BACKUPS, from);
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.log("");
    console.log(`${from} does not look like a backup folder (no manifest.json inside).`);
    console.log("Available backups:");
    for (const name of listBackups()) console.log(`  ${name}`);
    console.log("");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  // Read every file first, so a missing or corrupt file is found before
  // anything at all is touched in the database.
  const files = [];
  let planned = 0;
  for (const entry of manifest.tables) {
    const path = join(dir, entry.file);
    if (!existsSync(path)) {
      console.log("");
      console.log(`The file for table "${entry.name}" is missing (${entry.file}), so nothing was changed.`);
      console.log("");
      process.exit(1);
    }
    const text = readFileSync(path, "utf8");
    let rows;
    try {
      rows = JSON.parse(text);
    } catch {
      console.log("");
      console.log(`The file for table "${entry.name}" is not readable JSON, so nothing was changed.`);
      console.log("");
      process.exit(1);
    }
    if (!Array.isArray(rows) || rows.length !== entry.rows) {
      console.log("");
      console.log(
        `Table "${entry.name}" should hold ${entry.rows} rows but its file holds ${
          Array.isArray(rows) ? rows.length : "something else"
        }, so nothing was changed.`,
      );
      console.log("");
      process.exit(1);
    }
    files.push({ name: entry.name, rows, expected: entry.rows });
    planned += rows.length;
  }

  const liveHash = await appliedHash(client);
  console.log("");
  console.log(`LIS 815 LMS - restore from ${from}`);
  console.log(`  ${manifest.tables.length} tables, ${planned} rows to put back`);
  console.log(`  backup taken ${manifest.takenAt}`);
  if (manifest.schemaSqlSha256 && liveHash && manifest.schemaSqlSha256 !== liveHash) {
    console.log("");
    console.log("  WARNING: the migrations installed now are not the ones this backup was taken with.");
    console.log("  Run  npm run db:push  first so the structure matches, then restore again.");
    if (!has("--force")) {
      console.log("  (pass --force to restore anyway)");
      console.log("");
      process.exit(1);
    }
  }

  if (!dryRun && !assumeYes) {
    console.log("");
    console.log("  This DELETES the current rows and replaces them with this backup.");
    if (!process.stdin.isTTY) {
      console.log("  There is no keyboard here to confirm with, so nothing was changed.");
      console.log("  Run it from your own terminal, or add --yes if you are sure.");
      console.log("");
      process.exit(1);
    }
    const answer = await ask(`  Type the backup name (${from}) to confirm: `);
    if (answer !== from) {
      console.log("  That did not match, so nothing was changed.");
      console.log("");
      process.exit(1);
    }
  }

  const edges = await foreignKeys(client);
  const all = await listTables(client);
  const order = orderTables(all, edges);

  console.log("");
  console.log(
    dryRun
      ? "  Dry run: the whole restore is being rehearsed inside a transaction."
      : "  Restoring inside a single transaction. Please leave this window alone.",
  );

  try {
    await client.query("begin");
    await client.query("set statement_timeout = 0");

    for (const name of [...order].reverse()) {
      await client.query(`delete from public.${name}`);
    }
    for (const name of order) {
      const entry = files.find((f) => f.name === name);
      if (!entry) continue;
      if (entry.rows.length) {
        // Reindex triggers fire as the content tables go back in and repopulate
        // tables like search_index, so a row that already exists there is skipped
        // rather than treated as a failure. The count below is what decides.
        await client.query(
          `insert into public.${name} select * from json_populate_recordset(null::public.${name}, $1::json)
           on conflict do nothing`,
          [JSON.stringify(entry.rows)],
        );
      }
      const { rows } = await client.query(`select count(*)::int as n from public.${name}`);
      if (Number(rows[0].n) !== entry.expected) {
        throw new Error(
          `table "${name}" holds ${rows[0].n} rows after the restore but the backup holds ${entry.expected}`,
        );
      }
    }

    if (dryRun) {
      await client.query("rollback");
      console.log("");
      console.log("  Dry run passed: every file read, every row count matched.");
      console.log("  Nothing was changed. The real command is:");
      console.log(`    npm run db:restore -- --from ${from} --yes`);
      console.log("");
      return;
    }

    await client.query("commit");
    console.log("");
    console.log(`  Restored ${planned} rows across ${files.length} tables.`);
    console.log("  Nothing else to do here.");
    console.log("");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.log("");
    console.log("  The restore failed, so the database was left exactly as it was.");
    report(error);
    process.exit(1);
  }
}

function listBackups() {
  if (!existsSync(BACKUPS)) return [];
  return readdirSync(BACKUPS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(BACKUPS, e.name, "manifest.json")))
    .map((e) => e.name)
    .sort()
    .reverse();
}

function latestBackup() {
  return listBackups()[0] || null;
}

// ---------------------------------------------------------------------------

async function main() {
  const pg = (await import("pg")).default;
  const { client } = await connect(pg, {
    applicationName: restoreMode ? "lis815-db-restore" : "lis815-db-backup",
  });
  try {
    if (restoreMode) await runRestore(client);
    else await runBackup(client);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("\nThat did not work:", e.message);
  console.error(restoreMode ? "The database was not changed." : "No backup was written.");
  process.exit(1);
});
