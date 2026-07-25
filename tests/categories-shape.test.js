import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES,
  FLAG_CATEGORY_IDS,
  CREDIT_CATEGORY_IDS,
  SEVERITY_IDS,
  SEVERITY_MULTIPLIER,
} from "../extension/src/pipeline/rubric/categories.js";
import { CATEGORY_REFERENCES } from "../extension/src/pipeline/rubric/reference-examples.js";

const enMessagesPath = fileURLToPath(
  new URL("../extension/_locales/en/messages.json", import.meta.url),
);
const enMessages = JSON.parse(readFileSync(enMessagesPath, "utf8"));
const enKeys = new Set(Object.keys(enMessages));

test("every CATEGORIES entry has kind, weight and msg", () => {
  for (const [id, cat] of Object.entries(CATEGORIES)) {
    assert.ok(cat.kind === "flag" || cat.kind === "credit", `${id} has valid kind`);
    assert.ok(typeof cat.weight === "number" && cat.weight >= 0, `${id} has non-negative weight`);
    assert.ok(typeof cat.msg === "string" && cat.msg.length > 0, `${id} has msg key`);
  }
});

test("every CATEGORIES.msg key exists in _locales/en/messages.json", () => {
  for (const [id, cat] of Object.entries(CATEGORIES)) {
    assert.ok(enKeys.has(cat.msg), `${id} msg key ${cat.msg} must be in English locale`);
  }
});

test("FLAG_CATEGORY_IDS and CREDIT_CATEGORY_IDS partition CATEGORIES", () => {
  const flagSet = new Set(FLAG_CATEGORY_IDS);
  const creditSet = new Set(CREDIT_CATEGORY_IDS);
  for (const id of Object.keys(CATEGORIES)) {
    assert.equal(
      flagSet.has(id) !== creditSet.has(id),
      true,
      `${id} must be in exactly one partition`,
    );
  }
  assert.equal(flagSet.size + creditSet.size, Object.keys(CATEGORIES).length);
});

test("SEVERITY_IDS and SEVERITY_MULTIPLIER agree", () => {
  const multipliers = Object.keys(SEVERITY_MULTIPLIER);
  assert.equal(SEVERITY_IDS.length, multipliers.length);
  for (const s of SEVERITY_IDS) {
    assert.ok(typeof SEVERITY_MULTIPLIER[s] === "number", `severity ${s} has a multiplier`);
  }
});

test("every category id has a reference-examples entry with match and notMatch", () => {
  for (const id of Object.keys(CATEGORIES)) {
    const ref = CATEGORY_REFERENCES[id];
    assert.ok(ref, `${id} has a reference-examples block`);
    assert.ok(
      typeof ref.definition === "string" && ref.definition.length > 0,
      `${id} has definition`,
    );
    assert.ok(Array.isArray(ref.match) && ref.match.length >= 3, `${id} has >= 3 match examples`);
    assert.ok(
      Array.isArray(ref.notMatch) && ref.notMatch.length >= 3,
      `${id} has >= 3 notMatch examples`,
    );
  }
});
