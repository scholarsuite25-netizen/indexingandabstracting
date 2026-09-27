#!/usr/bin/env node
// LIS 815 LMS - the whole gate in one command.
//
//   npm run test:all
//
// Every suite runs in order and the first genuine failure stops the run, exactly like
// the chain of "&&" this replaces. The difference is that the suites talk to the live
// Supabase project over this machine's internet connection, which drops a request now
// and then. A suite that failed only on those ("fetch failed" and friends) is retried;
// a suite that failed on its own assertions is not, because a retry would hide a real
// problem.

import { spawn } from "node:child_process";

const SUITES = [
  "check:content",
  "check:sql",
  "test:rls",
  "test:progress",
  "test:assessment",
  "test:theory",
  "test:tooling",
  "test:dashboards",
];

const NETWORK = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i;
const MAX_RETRIES = Number(process.env.TEST_ALL_RETRIES ?? 2);
const RETRY_WAIT_MS = 15_000;
const GAP_MS = 4_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(name) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", name], {
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let out = "";
    const onData = (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stdout.write(text);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      out += error.message;
      resolve({ code: 1, out });
    });
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

const results = [];
let stopAt = null;

for (const name of SUITES) {
  console.log(`\n===== ${name} =====\n`);
  let attempt = await run(name);
  let retries = 0;

  while (attempt.code !== 0 && NETWORK.test(attempt.out) && retries < MAX_RETRIES) {
    retries += 1;
    console.log(`\n  ${name} lost the connection (retry ${retries} of ${MAX_RETRIES}).`);
    console.log(`  Waiting ${RETRY_WAIT_MS / 1000}s before trying it again...\n`);
    await sleep(RETRY_WAIT_MS);
    attempt = await run(name);
  }

  results.push({ name, code: attempt.code, retries });
  if (attempt.code !== 0) {
    stopAt = name;
    break;
  }
  await sleep(GAP_MS);
}

console.log("\n===== summary =====\n");
for (const r of results) {
  const state = r.code === 0 ? "ok  " : "FAIL";
  const note = r.retries ? ` (${r.retries} network ${r.retries === 1 ? "retry" : "retries"})` : "";
  console.log(`  ${state}  ${r.name}${note}`);
}
const skipped = SUITES.slice(results.length);
if (skipped.length) console.log(`  skipped after ${stopAt}: ${skipped.join(", ")}`);
console.log("");

process.exit(results.every((r) => r.code === 0) ? 0 : 1);
