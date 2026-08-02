import { test } from "node:test";
import assert from "node:assert/strict";
import { RISK_BANDS, bandForScore } from "../extension/src/shared/risk-bands.js";
import { gradeOf } from "../extension/src/pipeline/rubric/score.js";

test("bandForScore maps the documented grade thresholds", () => {
  assert.equal(bandForScore(0).grade, "A");
  assert.equal(bandForScore(8).grade, "A");
  assert.equal(bandForScore(9).grade, "B");
  assert.equal(bandForScore(22).grade, "B");
  assert.equal(bandForScore(23).grade, "C");
  assert.equal(bandForScore(44).grade, "C");
  assert.equal(bandForScore(45).grade, "D");
  assert.equal(bandForScore(65).grade, "D");
  assert.equal(bandForScore(66).grade, "F");
  assert.equal(bandForScore(100).grade, "F");
});

test("non-finite scores fall back to the worst band", () => {
  assert.equal(bandForScore(NaN).grade, "F");
  assert.equal(bandForScore(undefined).grade, "F");
  assert.equal(bandForScore("bad").grade, "F");
});

test("gradeOf is derived from the same table as bandForScore", () => {
  for (let score = 0; score <= 100; score += 1) {
    assert.equal(gradeOf(score), bandForScore(score).grade, `mismatch at score ${score}`);
  }
});

test("grade B reads as low-risk green, not moderate yellow (regression)", () => {
  const band = bandForScore(11);
  assert.equal(band.grade, "B");
  assert.equal(band.colorVar, "--green");
  assert.equal(band.labelFallback, "Low risk");
});

test("colour and label are consistent across the whole scale by construction", () => {
  // A single band owns both colour and label, so a given score can never get a
  // colour from one threshold table and a label from a differently-cut one.
  const colourForLabel = new Map();
  for (const band of RISK_BANDS) {
    if (colourForLabel.has(band.labelFallback)) {
      assert.equal(
        colourForLabel.get(band.labelFallback),
        band.colorVar,
        `label "${band.labelFallback}" must always map to one colour`,
      );
    } else {
      colourForLabel.set(band.labelFallback, band.colorVar);
    }
  }
});
