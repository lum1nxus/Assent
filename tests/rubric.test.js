import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, gradeOf } from "../extension/src/pipeline/rubric/score.js";
import { CATEGORIES } from "../extension/src/pipeline/rubric/categories.js";
import { buildSummary } from "../extension/src/pipeline/rubric/summary.js";
import { resolveTitle } from "../extension/src/pipeline/rubric/labels.js";

test("gradeOf maps thresholds correctly", () => {
  assert.equal(gradeOf(0), "A");
  assert.equal(gradeOf(8), "A");
  assert.equal(gradeOf(9), "B");
  assert.equal(gradeOf(22), "B");
  assert.equal(gradeOf(23), "C");
  assert.equal(gradeOf(44), "C");
  assert.equal(gradeOf(45), "D");
  assert.equal(gradeOf(65), "D");
  assert.equal(gradeOf(66), "F");
  assert.equal(gradeOf(100), "F");
});

test("gradeOf returns F for non-finite values", () => {
  assert.equal(gradeOf(NaN), "F");
  assert.equal(gradeOf(undefined), "F");
  assert.equal(gradeOf("bad"), "F");
});

test("no flags and no credits scores 0 / A", () => {
  const r = computeScore([], []);
  assert.equal(r.score, 0);
  assert.equal(r.grade, "A");
});

test("computeScore tolerates non-array input", () => {
  const r = computeScore(undefined, null);
  assert.equal(r.score, 0);
  assert.equal(r.grade, "A");
});

test("a single partial low-weight flag stays in A", () => {
  const r = computeScore([{ category: "services_as_is", severity: "partial" }], []);
  assert.equal(r.score, 2);
  assert.equal(r.grade, "A");
});

test("three high-impact flags push score into D", () => {
  const r = computeScore(
    [
      { category: "mandatory_arbitration", severity: "high" },
      { category: "class_action_waiver", severity: "full" },
      { category: "broad_indemnity_from_user", severity: "high" },
    ],
    [],
  );
  assert.equal(r.score, Math.round(15 * 1.5 + 14 + 12 * 1.5));
  assert.equal(r.grade, "D");
});

test("a stack of unfavourable clauses lands in F", () => {
  const r = computeScore(
    [
      { category: "mandatory_arbitration", severity: "high" },
      { category: "class_action_waiver", severity: "full" },
      { category: "broad_indemnity_from_user", severity: "high" },
      { category: "broad_limitation_of_liability", severity: "high" },
      { category: "unilateral_terms_change_no_notice", severity: "full" },
    ],
    [],
  );
  assert.equal(r.score, Math.round(15 * 1.5 + 14 + 12 * 1.5 + 8 * 1.5 + 14));
  assert.equal(r.grade, "F");
});

test("credits lower the score", () => {
  const a = computeScore([{ category: "services_as_is", severity: "full" }], []);
  const b = computeScore(
    [{ category: "services_as_is", severity: "full" }],
    [{ category: "easy_account_deletion" }, { category: "explicit_refund_window" }],
  );
  assert.ok(b.score < a.score, `expected ${b.score} < ${a.score}`);
});

test("unknown categories are dropped, not added to the score", () => {
  const r = computeScore(
    [{ category: "definitely_not_a_real_category", severity: "high" }],
    [{ category: "also_fake" }],
  );
  assert.equal(r.score, 0);
});

test("unknown severity defaults to 1.0x weight", () => {
  const r = computeScore([{ category: "mandatory_arbitration", severity: "weird" }], []);
  assert.equal(r.score, 15);
  assert.equal(r.grade, "B");
});

test("severity multipliers are monotonic high > full > partial", () => {
  const high = computeScore([{ category: "mandatory_arbitration", severity: "high" }], []).score;
  const full = computeScore([{ category: "mandatory_arbitration", severity: "full" }], []).score;
  const partial = computeScore(
    [{ category: "mandatory_arbitration", severity: "partial" }],
    [],
  ).score;
  assert.ok(high > full && full > partial, `expected ${high} > ${full} > ${partial}`);
});

test("score is clamped to 0..100 even with many high-severity flags", () => {
  const huge = Array(20).fill({ category: "mandatory_arbitration", severity: "high" });
  const r = computeScore(huge, []);
  assert.equal(r.score, 100);
  assert.equal(r.grade, "F");
});

test("credits cannot push the score below 0", () => {
  const r = computeScore([], Array(10).fill({ category: "easy_account_deletion" }));
  assert.equal(r.score, 0);
});

test("a positive clause in a flag slot is ignored, and vice versa", () => {
  const r = computeScore(
    [{ category: "easy_account_deletion", severity: "high" }],
    [{ category: "mandatory_arbitration" }],
  );
  assert.equal(r.score, 0);
});

test("expected category weights match the published rubric", () => {
  assert.equal(CATEGORIES.mandatory_arbitration.weight, 15);
  assert.equal(CATEGORIES.class_action_waiver.weight, 14);
  assert.equal(CATEGORIES.broad_content_license_irrevocable.weight, 18);
  assert.equal(CATEGORIES.data_resale_undisclosed_parties.weight, 16);
  assert.equal(CATEGORIES.easy_account_deletion.weight, 6);
  assert.equal(CATEGORIES.easy_account_deletion.kind, "credit");
  assert.equal(CATEGORIES.mandatory_arbitration.kind, "flag");
});

test("resolveTitle falls back to a prettified id without chrome.i18n", () => {
  assert.equal(resolveTitle("mandatory_arbitration"), "Mandatory Arbitration");
  assert.equal(resolveTitle("services_as_is"), "Services As Is");
  assert.equal(resolveTitle(""), "");
  assert.equal(resolveTitle("totally_unknown_category"), "Totally Unknown Category");
});

test("buildSummary returns empty string without flags", () => {
  assert.equal(buildSummary([]), "");
  assert.equal(buildSummary(undefined), "");
});

test("buildSummary picks the two highest-weighted flags", () => {
  const out = buildSummary([
    { category: "services_as_is", severity: "partial" },
    { category: "mandatory_arbitration", severity: "high" },
    { category: "class_action_waiver", severity: "full" },
  ]);
  assert.ok(out.includes("Mandatory Arbitration"), `got: ${out}`);
  assert.ok(out.includes("Class Action Waiver"), `got: ${out}`);
  assert.ok(!out.includes("Services As Is"), `should not include lowest-weight: ${out}`);
});

test("computeScore on a high-risk fintech-shaped output goes well above 45", () => {
  const highRiskFintech = computeScore(
    [
      { category: "mandatory_arbitration", severity: "high" },
      { category: "class_action_waiver", severity: "full" },
      { category: "broad_indemnity_from_user", severity: "high" },
      { category: "broad_limitation_of_liability", severity: "high" },
      { category: "governing_law_distant_venue", severity: "partial" },
    ],
    [],
  );
  assert.ok(highRiskFintech.score > 45, `expected > 45, got ${highRiskFintech.score}`);
  assert.ok(highRiskFintech.grade === "D" || highRiskFintech.grade === "F");
});

test("computeScore on a content-platform-shaped output is much lower", () => {
  const contentPlatform = computeScore(
    [
      { category: "broad_content_license_irrevocable", severity: "high" },
      { category: "services_as_is", severity: "partial" },
    ],
    [],
  );
  assert.ok(contentPlatform.score < 30, `expected < 30, got ${contentPlatform.score}`);
});

test("credit cap prevents stuffing credits to wash out flags", () => {
  const flags = [
    { category: "mandatory_arbitration", severity: "high" },
    { category: "class_action_waiver", severity: "full" },
    { category: "broad_indemnity_from_user", severity: "full" },
  ];
  const stackedCredits = computeScore(flags, [
    { category: "easy_account_deletion" },
    { category: "explicit_refund_window" },
    { category: "no_automatic_renewal" },
    { category: "transparent_retention_period" },
    { category: "free_data_export" },
    { category: "user_retains_content_ownership" },
  ]);
  const noCredits = computeScore(flags, []);
  const drop = noCredits.score - stackedCredits.score;
  assert.ok(
    drop <= Math.ceil(noCredits.score * 0.45),
    `credits should shave at most ~40% of penalty, got drop=${drop} from ${noCredits.score}`,
  );
  assert.equal(noCredits.grade, "D");
  assert.equal(stackedCredits.grade, "C");
});

test("two services with different risk profiles get different grades", () => {
  const a = computeScore(
    [{ category: "services_as_is", severity: "partial" }],
    [{ category: "easy_account_deletion" }],
  );
  const b = computeScore(
    [
      { category: "mandatory_arbitration", severity: "high" },
      { category: "class_action_waiver", severity: "full" },
      { category: "broad_indemnity_from_user", severity: "high" },
      { category: "broad_limitation_of_liability", severity: "high" },
    ],
    [],
  );
  assert.notEqual(a.grade, b.grade, `both got grade ${a.grade}`);
});
