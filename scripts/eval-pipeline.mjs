#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { parseAndValidate } from "../extension/src/pipeline/steps/analyze.js";
import { computeScore } from "../extension/src/pipeline/rubric/score.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const fixturesDir = join(repoRoot, "tests", "fixtures", "ai-outputs");
const corpusPath = join(repoRoot, "tests", "fixtures", "synthetic-tos", "corpus.json");

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const verbose = args.includes("--verbose");

const pad = (s, n) => String(s).padEnd(n);
const colour = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => colour("32", s);
const red = (s) => colour("31", s);
const yellow = (s) => colour("33", s);
const dim = (s) => colour("90", s);

function runAiOutputs() {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  const results = [];
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
    if (onlyArg && !fixture.name.includes(onlyArg)) {
      continue;
    }
    const r = { file, name: fixture.name, status: "pass", details: "" };
    try {
      const parsed = parseAndValidate(fixture.rawAiResponse, fixture.documentText);
      const actualFlags = parsed.flags.map((f) => f.category);
      const expectedFlags = fixture.expectedFlags.map((f) => f.category);
      const actualCredits = parsed.credits.map((c) => c.category);
      const expectedCredits = fixture.expectedCredits.map((c) => c.category);
      if (JSON.stringify(actualFlags) !== JSON.stringify(expectedFlags)) {
        r.status = "fail";
        r.details = `flags differ: expected ${JSON.stringify(expectedFlags)}, got ${JSON.stringify(actualFlags)}`;
      } else if (JSON.stringify(actualCredits) !== JSON.stringify(expectedCredits)) {
        r.status = "fail";
        r.details = `credits differ: expected ${JSON.stringify(expectedCredits)}, got ${JSON.stringify(actualCredits)}`;
      } else {
        r.parsed = parsed;
        const { score, grade } = computeScore(parsed.flags, parsed.credits);
        r.score = score;
        r.grade = grade;
      }
    } catch (err) {
      r.status = "fail";
      r.details = `threw: ${err.message}`;
    }
    results.push(r);
  }
  return results;
}

function runCorpus() {
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
  const results = [];
  for (const fx of corpus.fixtures) {
    if (onlyArg && !fx.id.includes(onlyArg)) {
      continue;
    }
    const { score, grade } = computeScore(fx.flags, fx.credits);
    const r = {
      file: "corpus.json",
      name: fx.id,
      profile: fx.profile,
      expected_grade: fx.expected_grade,
      score,
      grade,
      status: grade === fx.expected_grade ? "pass" : "fail",
    };
    if (r.status === "fail") {
      r.details = `expected ${fx.expected_grade}, got ${grade} (score=${score})`;
    }
    results.push(r);
  }
  return results;
}

function summarise(title, results) {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const head = `${title}: ${pass} pass / ${fail} fail / ${results.length} total`;
  console.log(fail === 0 ? green(head) : red(head));
  for (const r of results) {
    if (r.status === "fail") {
      console.log(red(`  FAIL ${pad(r.name, 50)} ${r.details ?? ""}`));
    } else if (verbose) {
      const tail =
        r.grade !== undefined
          ? dim(` score=${r.score} grade=${r.grade}`)
          : "";
      console.log(`  ${green("ok")}   ${pad(r.name, 50)}${tail}`);
    }
  }
  return fail;
}

console.log(yellow(`Pipeline eval against ${relative(repoRoot, fixturesDir)}`));
const aiFail = summarise("AI-output replays", runAiOutputs());
console.log();
console.log(yellow(`Rubric eval against ${relative(repoRoot, corpusPath)}`));
const corpusFail = summarise("Synthetic ToS corpus", runCorpus());
console.log();
if (aiFail + corpusFail === 0) {
  console.log(green("All fixtures pass."));
  process.exit(0);
}
console.log(red(`${aiFail + corpusFail} failure(s).`));
process.exit(1);
