// Shared database connection for the scripts in this folder.
//
// Both `npm run db:push` and `npm run db:backup` need the same three things: the
// settings from .env.local, a way to ask for the password without saving it, and a
// connection that works through Supabase's IPv4 pooler. Keeping them in one place is
// the only reason the second script did not have to copy the first script's
// troubleshooting text word for word.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadEnv() {
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

// Read .env.local before anything looks at process.env, so projectRef below sees it.
loadEnv();

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const projectRef = projectUrl ? new URL(projectUrl).hostname.split(".")[0] : null;

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

export function plainReason(message) {
  for (const [code, text] of Object.entries(PLAIN)) {
    if (message.includes(code)) return text;
  }
  return null;
}

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

function missingPasswordHelp() {
  console.log("");
  console.log("No database password, so nothing was changed.");
  console.log("");
  console.log("To get it, in the Supabase dashboard:");
  console.log(
    "  1. Open your project (the one whose address is the NEXT_PUBLIC_SUPABASE_URL in .env.local)",
  );
  console.log("  2. Click the gear icon, Settings, then Database");
  console.log("  3. Under Database password, click the eye icon and press Copy");
  console.log("  4. Come back and run this command again, then paste it when asked");
  console.log("");
  console.log("To stop being asked every time, add one of these lines to .env.local:");
  console.log("  SUPABASE_DB_PASSWORD=paste-it-here");
  console.log(
    "or, better, the whole connection string from the same page:",
  );
  console.log(
    "  DATABASE_URL=postgresql://postgres:yourpassword@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
  );
  console.log("");
}

export async function connect(pg, { applicationName = "lis815-db" } = {}) {
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
      console.log(
        "  postgresql://postgres:yourpassword@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
      );
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
      application_name: applicationName,
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
    missingPasswordHelp();
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
      application_name: applicationName,
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
