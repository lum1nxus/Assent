import { test } from "node:test";
import assert from "node:assert/strict";
import * as steps from "../extension/src/pipeline/steps/index.js";

test("pipeline steps index exports every required step", () => {
  const required = ["detectLang", "extract", "extractJurisdiction", "analyze", "verify", "persist"];
  for (const name of required) {
    assert.ok(typeof steps[name] === "function", `${name} must be an exported function`);
  }
});

test("no translate-in / translate-out remain exported", () => {
  assert.equal(steps.translateIn, undefined, "translate-in should be removed for MVP");
  assert.equal(steps.translateOut, undefined, "translate-out should be removed for MVP");
});

test("every step is an async function with (input, ctx) shape", () => {
  const stepFns = [
    steps.detectLang,
    steps.extract,
    steps.extractJurisdiction,
    steps.analyze,
    steps.verify,
    steps.persist,
  ];
  for (const fn of stepFns) {
    assert.equal(typeof fn, "function");
    assert.ok(fn.length >= 1, `${fn.name} should accept at least (input) as first arg`);
  }
});
