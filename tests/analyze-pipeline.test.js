import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseAndValidate } from "../extension/src/pipeline/steps/analyze.js";
import { computeScore } from "../extension/src/pipeline/rubric/score.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures", "ai-outputs");

const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    const path = join(fixturesDir, f);
    const data = JSON.parse(readFileSync(path, "utf8"));
    return { file: f, ...data };
  });

test("ai-outputs fixture set is populated", () => {
  assert.ok(fixtures.length >= 10, `expected >= 10 fixtures, got ${fixtures.length}`);
});

test("every ai-output fixture is well-formed", () => {
  for (const f of fixtures) {
    assert.ok(typeof f.name === "string" && f.name.length > 0, `${f.file} missing name`);
    assert.ok(typeof f.documentText === "string", `${f.file} missing documentText`);
    assert.ok(typeof f.rawAiResponse === "string", `${f.file} missing rawAiResponse`);
    assert.ok(Array.isArray(f.expectedFlags), `${f.file} missing expectedFlags array`);
    assert.ok(Array.isArray(f.expectedCredits), `${f.file} missing expectedCredits array`);
    assert.ok(
      typeof f.expectedReason === "string" && f.expectedReason.length > 0,
      `${f.file} missing expectedReason`,
    );
  }
});

for (const fixture of fixtures) {
  test(`ai-output replay: ${fixture.name}`, () => {
    let parsed;
    try {
      parsed = parseAndValidate(fixture.rawAiResponse, fixture.documentText);
    } catch (err) {
      assert.fail(`${fixture.name}: parseAndValidate threw - ${err.message}`);
    }

    const actualFlagCats = parsed.flags.map((f) => f.category);
    const expectedFlagCats = fixture.expectedFlags.map((f) => f.category);
    assert.deepEqual(
      actualFlagCats,
      expectedFlagCats,
      `${fixture.name}: flag categories differ.\n  expected: ${JSON.stringify(expectedFlagCats)}\n  actual:   ${JSON.stringify(actualFlagCats)}\n  reason:   ${fixture.expectedReason}`,
    );

    for (let i = 0; i < fixture.expectedFlags.length; i += 1) {
      if (fixture.expectedFlags[i].severity) {
        assert.equal(
          parsed.flags[i].severity,
          fixture.expectedFlags[i].severity,
          `${fixture.name}: flag ${i} severity mismatch`,
        );
      }
    }

    const actualCreditCats = parsed.credits.map((c) => c.category);
    const expectedCreditCats = fixture.expectedCredits.map((c) => c.category);
    assert.deepEqual(
      actualCreditCats,
      expectedCreditCats,
      `${fixture.name}: credit categories differ.\n  expected: ${JSON.stringify(expectedCreditCats)}\n  actual:   ${JSON.stringify(actualCreditCats)}\n  reason:   ${fixture.expectedReason}`,
    );
  });
}

test("happy-friendly-tos lands in grade A after scoring", () => {
  const fixture = fixtures.find((f) => f.name === "happy-friendly-tos");
  assert.ok(fixture, "happy-friendly-tos fixture is required");
  const parsed = parseAndValidate(fixture.rawAiResponse, fixture.documentText);
  const { grade } = computeScore(parsed.flags, parsed.credits);
  assert.equal(grade, "A");
});

test("happy-aggressive-tos lands in grade F after scoring", () => {
  const fixture = fixtures.find((f) => f.name === "happy-aggressive-tos");
  assert.ok(fixture, "happy-aggressive-tos fixture is required");
  const parsed = parseAndValidate(fixture.rawAiResponse, fixture.documentText);
  const { grade } = computeScore(parsed.flags, parsed.credits);
  assert.equal(grade, "F");
});
