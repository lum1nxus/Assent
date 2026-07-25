import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteLooksSpliced } from "../extension/src/pipeline/steps/category-guards.js";

test("quoteLooksSpliced detects ASCII ellipsis", () => {
  assert.equal(quoteLooksSpliced("We may modify ... at any time without notice"), true);
});

test("quoteLooksSpliced detects unicode ellipsis", () => {
  assert.equal(quoteLooksSpliced("We may modify \u2026 at any time"), true);
});

test("quoteLooksSpliced detects bracketed omission marker", () => {
  assert.equal(quoteLooksSpliced("We may modify [...] at any time"), true);
});

test("quoteLooksSpliced detects 'omitted' marker", () => {
  assert.equal(quoteLooksSpliced("We may modify [omitted] at any time"), true);
});

test("quoteLooksSpliced lets a continuous quote pass", () => {
  assert.equal(quoteLooksSpliced("We may modify these terms at any time without notice."), false);
});

test("quoteLooksSpliced is safe on empty and non-string input", () => {
  assert.equal(quoteLooksSpliced(""), false);
  assert.equal(quoteLooksSpliced(null), false);
  assert.equal(quoteLooksSpliced(undefined), false);
});
