#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { parseAndValidate } from "../extension/src/pipeline/steps/analyze.js";
import { computeScore } from "../extension/src/pipeline/rubric/score.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const fixturesDir = join(repoRoot, "tests", "fixtures", "ai-outputs");

const colour = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => colour("32", s);
const red = (s) => colour("31", s);
const yellow = (s) => colour("33", s);
const dim = (s) => colour("90", s);
const bold = (s) => colour("1", s);

function usage() {
  console.error(
    [
      "usage: node scripts/replay-debug.mjs <bundle.json> [--save-as <fixture-name>]",
      "",
      "Reads a debug bundle exported from the side panel, replays it through",
      "parseAndValidate + computeScore, and prints what the deterministic side of",
      "the pipeline produces. Use --save-as to drop the bundle into the regression",
      "suite at tests/fixtures/ai-outputs/<fixture-name>.json.",
    ].join("\n"),
  );
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
}
const bundlePath = args[0];
if (!bundlePath || !existsSync(bundlePath)) {
  console.error(red(`bundle file not found: ${bundlePath}`));
  process.exit(2);
}
const saveAsIdx = args.indexOf("--save-as");
const saveAs = saveAsIdx > 0 ? args[saveAsIdx + 1] : null;

const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));

if (!bundle.rawAiResponse || !bundle.documentText) {
  console.error(red("bundle is missing rawAiResponse or documentText"));
  console.error(dim("hint: this bundle was captured before analysis finished"));
  console.error(dim(`status was: ${bundle.status ?? "unknown"}`));
  process.exit(2);
}

console.log(bold(`Replaying ${basename(bundlePath)}`));
console.log(dim(`  domain:        ${bundle.domain ?? "unknown"}`));
console.log(dim(`  version:       ${bundle.version ?? "unknown"}`));
console.log(dim(`  tabUrl:        ${bundle.tabUrl ?? "n/a"}`));
console.log(dim(`  extractedWords:${bundle.extractedWords ?? "n/a"}`));
console.log(dim(`  tosLanguage:   ${bundle.tosLanguage ?? "n/a"}`));
console.log(dim(`  jurisdiction:  ${bundle.jurisdictionContext?.declaredRegion ?? "n/a"}`));
console.log(dim(`  documentText:  ${bundle.documentText.length} bytes`));
console.log(dim(`  rawAiResponse: ${bundle.rawAiResponse.length} bytes`));
console.log();

let parsed;
try {
  parsed = parseAndValidate(bundle.rawAiResponse, bundle.documentText);
} catch (err) {
  console.error(red(`parseAndValidate threw: ${err.message}`));
  process.exit(1);
}

const { score, grade } = computeScore(parsed.flags, parsed.credits);

const isBundle = bundle.score !== undefined || bundle.grade !== undefined;
const persistedFlagSource = bundle.flags ?? bundle.expectedFlags ?? null;
const persistedCreditSource = bundle.credits ?? bundle.expectedCredits ?? null;

if (isBundle && persistedFlagSource && persistedCreditSource) {
  const persistedFlagCats = persistedFlagSource.map((f) => f.category).sort();
  const replayedFlagCats = parsed.flags.map((f) => f.category).sort();
  const persistedCreditCats = persistedCreditSource.map((c) => c.category).sort();
  const replayedCreditCats = parsed.credits.map((c) => c.category).sort();

  const flagsMatch = JSON.stringify(persistedFlagCats) === JSON.stringify(replayedFlagCats);
  const creditsMatch = JSON.stringify(persistedCreditCats) === JSON.stringify(replayedCreditCats);

  const row = (label, persisted, replayed, ok) => {
    const tag = ok ? green("OK  ") : red("DIFF");
    console.log(`  ${tag} ${label.padEnd(8)} persisted=${persisted}   replayed=${replayed}`);
  };

  console.log(bold("Comparison (persisted in bundle vs replayed now)"));
  row("score", bundle.score, score, bundle.score === score);
  row("grade", bundle.grade, grade, bundle.grade === grade);
  row("flags", JSON.stringify(persistedFlagCats), JSON.stringify(replayedFlagCats), flagsMatch);
  row("credits", JSON.stringify(persistedCreditCats), JSON.stringify(replayedCreditCats), creditsMatch);
  console.log();
} else {
  console.log(bold("Replay output (no persisted score in input)"));
  console.log(`  score = ${score}   grade = ${grade}`);
  console.log();
}

console.log(bold("Replayed flags"));
if (parsed.flags.length === 0) {
  console.log(yellow("  (none)"));
} else {
  for (const f of parsed.flags) {
    const q = (f.quote ?? "").slice(0, 90).replace(/\s+/g, " ");
    console.log(`  - ${f.category} (${f.severity})  ${dim(`"${q}${(f.quote ?? "").length > 90 ? "..." : ""}"`)}`);
  }
}
console.log();
console.log(bold("Replayed credits"));
if (parsed.credits.length === 0) {
  console.log(yellow("  (none)"));
} else {
  for (const c of parsed.credits) {
    const q = (c.quote ?? "").slice(0, 90).replace(/\s+/g, " ");
    console.log(`  - ${c.category}  ${dim(`"${q}${(c.quote ?? "").length > 90 ? "..." : ""}"`)}`);
  }
}
console.log();

if (isBundle && (bundle.score !== score || bundle.grade !== grade)) {
  console.log(
    yellow(
      "Heads up: replay differs from persisted result. Either the bundle was captured on a different version, or a guard/rubric change has shifted output.",
    ),
  );
}

if (saveAs) {
  const fixtureName = saveAs.endsWith(".json") ? saveAs : `${saveAs}.json`;
  const target = join(fixturesDir, fixtureName);
  const fixture = {
    name: saveAs.replace(/\.json$/, ""),
    documentText: bundle.documentText,
    rawAiResponse: bundle.rawAiResponse,
    expectedFlags: parsed.flags.map((f) => ({ category: f.category, severity: f.severity })),
    expectedCredits: parsed.credits.map((c) => ({ category: c.category })),
    expectedReason:
      "captured from a real Chrome session via Side Panel -> Debug -> Download .json; replayed via npm run replay",
  };
  writeFileSync(target, JSON.stringify(fixture, null, 2) + "\n");
  console.log(green(`Saved regression fixture: ${target}`));
  console.log(
    dim(
      "Edit expectedFlags/expectedCredits/expectedReason if the captured output is itself a bug we want to lock down as failing then fixed.",
    ),
  );
}
