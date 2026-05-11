import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeScore } from "../extension/src/pipeline/rubric/score.js";

const here = dirname(fileURLToPath(import.meta.url));
const corpusPath = join(here, "fixtures", "synthetic-tos", "corpus.json");
const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));

const fixtures = corpus.fixtures;

test("corpus is populated with at least 30 fixtures", () => {
  assert.ok(
    Array.isArray(fixtures) && fixtures.length >= 30,
    `expected >= 30 fixtures, got ${fixtures?.length}`,
  );
});

test("corpus covers every band from A to F", () => {
  const grades = new Set(fixtures.map((f) => f.expected_grade));
  for (const g of ["A", "B", "C", "D", "F"]) {
    assert.ok(grades.has(g), `corpus is missing grade ${g}`);
  }
});

test("corpus fixtures have unique ids and well-formed shape", () => {
  const seen = new Set();
  for (const f of fixtures) {
    assert.ok(typeof f.id === "string" && f.id.length > 0, `bad id: ${f.id}`);
    assert.ok(!seen.has(f.id), `duplicate id: ${f.id}`);
    seen.add(f.id);
    assert.ok(Array.isArray(f.flags), `fixture ${f.id} missing flags array`);
    assert.ok(Array.isArray(f.credits), `fixture ${f.id} missing credits array`);
    assert.ok(
      ["A", "B", "C", "D", "F"].includes(f.expected_grade),
      `fixture ${f.id} has bad expected_grade: ${f.expected_grade}`,
    );
  }
});

for (const fixture of fixtures) {
  test(`corpus: ${fixture.id} (${fixture.profile}) lands in grade ${fixture.expected_grade}`, () => {
    const { score, grade } = computeScore(fixture.flags, fixture.credits);
    assert.equal(
      grade,
      fixture.expected_grade,
      `fixture ${fixture.id}: expected ${fixture.expected_grade}, got ${grade} (score=${score})`,
    );
  });
}

test("rubric produces a smooth distribution across the corpus", () => {
  const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const f of fixtures) {
    const { grade } = computeScore(f.flags, f.credits);
    buckets[grade] += 1;
  }
  for (const [grade, count] of Object.entries(buckets)) {
    assert.ok(
      count >= 3,
      `grade ${grade} only has ${count} fixture(s); rubric is clustering too aggressively`,
    );
  }
});
