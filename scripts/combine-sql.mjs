import fs from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const outputFile = path.join(process.cwd(), "supabase", "combined_migrations.sql");

// Every migration in the folder, in order - a new file is picked up without
// anyone having to remember to list it here.
const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

// The combined file is sent to Supabase by scripts/db-push.mjs, and older
// instructions had people paste it by hand, so it has to survive whatever
// editor and clipboard encoding a reader happens to use.
// Only the typographic characters we actually use are folded to ASCII; anything else
// is a hard error rather than a silent corruption.
const FOLD = new Map([
  ["—", "-"], // em dash
  ["–", "-"], // en dash
  ["‘", "'"],
  ["’", "'"],
  ["“", '"'],
  ["”", '"'],
  ["…", "..."],
  [" ", " "], // non-breaking space
  ["×", "x"]
]);

function toAscii(text, file) {
  let out = "";
  for (const ch of text) {
    if (ch.codePointAt(0) < 128) {
      out += ch;
      continue;
    }
    const folded = FOLD.get(ch);
    if (folded === undefined) {
      const line = text.slice(0, text.indexOf(ch)).split("\n").length;
      throw new Error(
        `${file} line ${line}: non-ASCII character ${JSON.stringify(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}) has no ASCII equivalent. Add it to FOLD in scripts/combine-sql.mjs or replace it in the migration.`
      );
    }
    out += folded;
  }
  return out;
}

let combined = "";

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  combined += `-- =========================================================================\n`;
  combined += `-- MIGRATION: ${file}\n`;
  combined += `-- =========================================================================\n\n`;
  combined += toAscii(content, file) + "\n\n";
}

fs.writeFileSync(outputFile, combined, "ascii");

const bytes = fs.statSync(outputFile).size;
const lines = combined.split("\n").length;
console.log(`Combined ${files.length} migrations into ${outputFile}`);
  console.log(`  ${lines} lines, ${bytes} bytes, pure ASCII (safe to send anywhere)`);
