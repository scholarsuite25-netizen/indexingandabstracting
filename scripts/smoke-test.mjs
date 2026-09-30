#!/usr/bin/env node
// LIS 815 LMS - the production smoke test: one command that checks the site that is
// actually deployed, exactly as a stranger and then a student would use it.
//
//   npm run test:smoke -- --url https://your-app.vercel.app
//   npm run test:smoke -- --url https://your-app.vercel.app --number LIS-ABC1234567
//   SMOKE_BASE_URL=https://your-app.vercel.app npm run test:smoke
//
// What it does, in order:
//   1. the front page answers, and it is the real site (not an error page);
//   2. signed-out visitors are bounced to the sign-in page everywhere it matters
//      (dashboard, staff area, superadmin area, the certificate page);
//   3. with --number, a real certificate number is checked on the live site — by the
//      signed-in half of the journey, because /verify/[number] needs a session;
//   4. the full signed-in learner journey runs against the live URL (that is
//      npm run test:pages pointed at this site: sign-in, reading, study tools,
//      downloads, certificate lookup, and the rules that keep locked content locked).
//
// It needs .env.local as usual (the journey signs in as a temporary student and
// deletes that account afterwards). Nothing on the site is changed except that one
// temporary account, which is created and removed by step 5.

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

function loadEnv() {
  try {
    const text = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* no .env.local yet */
  }
}
loadEnv();

const envUrl =
  process.env.SMOKE_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
const BASE = (valueOf("--url") || envUrl || "").replace(/\/+$/, "");
const NUMBER = valueOf("--number");

if (!BASE) {
  console.log("");
  console.log("Nowhere to check: no site address was given.");
  console.log("Run it as:");
  console.log("  npm run test:smoke -- --url https://your-app.vercel.app");
  console.log("or put one line in .env.local:");
  console.log("  SMOKE_BASE_URL=https://your-app.vercel.app");
  console.log("");
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

async function page(path) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const body =
    res.status === 307 || res.status === 308 || res.status === 404 ? "" : await res.text();
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    body,
    text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  };
}

async function main() {
  console.log("LIS 815 LMS — production smoke test");
  console.log(`  site: ${BASE}`);

  console.log("\nReachable");
  await test("the front page answers with the real site", async () => {
    const res = await page("/");
    assert(res.status === 200, `front page answered ${res.status}`);
    assert(res.body.length > 500, "the front page came back almost empty");
    assert(!/application error|internal server error/i.test(res.text), "an error page was served");
  });

  console.log("\nSigned out");
  await test("the public pages answer", async () => {
    for (const path of ["/help", "/login"]) {
      const res = await page(path);
      assert(res.status === 200, `${path} answered ${res.status}`);
    }
  });

  await test("protected pages bounce visitors to the sign-in page", async () => {
    for (const path of [
      "/dashboard",
      "/dashboard/certificate",
      "/admin",
      "/admin/certificates",
      "/superadmin",
      "/verify/NOT-A-REAL-CERTIFICATE",
    ]) {
      const res = await page(path);
      assert(res.status === 307 || res.status === 308, `${path} answered ${res.status}`);
      assert(res.location.includes("/login"), `${path} went to ${res.location || "(nowhere)"}`);
    }
  });

  console.log("\nSigned-in journey (npm run test:pages against this site)");
  const journey = spawnSync("npm", ["run", "test:pages"], {
    shell: true,
    stdio: "inherit",
    cwd: root,
    env: {
      ...process.env,
      PAGE_TEST_BASE_URL: BASE,
      ...(NUMBER ? { PAGE_TEST_CERT_NUMBER: NUMBER } : {}),
    },
  });
  const journeyOk = journey.status === 0;
  if (journeyOk) passed++;
  else failed++;
  console.log(`  ${journeyOk ? "PASS" : "FAIL"}  the full learner journey on the live site`);

  console.log("");
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("\nThe smoke test could not run:", error.message);
  console.error(`Is ${BASE} really the deployed site?`);
  process.exit(1);
});
