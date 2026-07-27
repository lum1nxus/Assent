import { test } from "node:test";
import assert from "node:assert/strict";
import { fitToInputBudget } from "../extension/src/pipeline/steps/analyze.js";

test("returns text unchanged when the session cannot measure usage", async () => {
  const out = await fitToInputBudget({}, "hello world");
  assert.equal(out, "hello world");
});

test("returns text unchanged when quota is not finite", async () => {
  const session = {
    inputQuota: Infinity,
    inputUsage: 0,
    measureInputUsage: async (t) => t.length,
  };
  const text = "x".repeat(500);
  assert.equal(await fitToInputBudget(session, text), text);
});

test("keeps the document intact when it already fits the budget", async () => {
  const session = {
    inputQuota: 1000,
    inputUsage: 100,
    measureInputUsage: async (t) => t.length,
  };
  const text = "x".repeat(200);
  assert.equal(await fitToInputBudget(session, text), text);
});

test("trims the document down to fit the remaining budget", async () => {
  const quota = 1000;
  const used = 100;
  const margin = 128;
  const budget = quota - used - margin;
  const session = {
    inputQuota: quota,
    inputUsage: used,
    measureInputUsage: async (t) => t.length,
  };
  const text = "x".repeat(2000);
  const out = await fitToInputBudget(session, text);
  assert.ok(out.length > 0, "should not empty the document");
  assert.ok(out.length < text.length, "should shrink the document");
  assert.ok((await session.measureInputUsage(out)) <= budget, "must fit the budget");
});

test("returns original text when measuring throws", async () => {
  const session = {
    inputQuota: 1000,
    inputUsage: 0,
    measureInputUsage: async () => {
      throw new Error("nope");
    },
  };
  const text = "x".repeat(500);
  assert.equal(await fitToInputBudget(session, text), text);
});

test("returns text unchanged when there is no budget left", async () => {
  const session = {
    inputQuota: 100,
    inputUsage: 100,
    measureInputUsage: async (t) => t.length,
  };
  const text = "x".repeat(500);
  assert.equal(await fitToInputBudget(session, text), text);
});
