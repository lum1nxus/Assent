import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteMatchesCategoryKeywords } from "../extension/src/pipeline/steps/category-guards.js";

const pass = (quote, category, kind = "flag") =>
  assert.equal(
    quoteMatchesCategoryKeywords(quote, category, kind),
    true,
    `${category} should accept: ${quote}`,
  );

const reject = (quote, category, kind = "flag") =>
  assert.equal(
    quoteMatchesCategoryKeywords(quote, category, kind),
    false,
    `${category} should reject: ${quote}`,
  );

test("mandatory_arbitration accepts a real arbitration clause", () => {
  pass(
    "Any dispute shall be resolved by binding individual arbitration in California.",
    "mandatory_arbitration",
  );
});

test("mandatory_arbitration rejects an acceptable-use clause (Bitwarden bug)", () => {
  reject(
    "You agree that you will not under any circumstances:attempt to disrupt or tamper with our servers",
    "mandatory_arbitration",
  );
});

test("class_action_waiver accepts a real waiver", () => {
  pass(
    "You waive any right to participate in a class action or class-wide arbitration.",
    "class_action_waiver",
  );
});

test("class_action_waiver rejects a generic dispute clause", () => {
  reject("Any disputes will be handled in good faith between the parties.", "class_action_waiver");
});

test("broad_content_license_irrevocable accepts a real license", () => {
  pass(
    "you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use, modify, and sublicense it",
    "broad_content_license_irrevocable",
  );
});

test("broad_content_license_irrevocable rejects a pure IP-retention clause", () => {
  reject(
    "Bitwarden and our licensors retain ownership of all intellectual property rights",
    "broad_content_license_irrevocable",
  );
});

test("broad_indemnity_from_user accepts the standard indemnity language", () => {
  pass("You agree to indemnify us, defend us, and hold us harmless", "broad_indemnity_from_user");
});

test("broad_warranty_disclaimer accepts an AS IS clause", () => {
  pass(
    'Bitwarden provides the Website and the Service "as is" and "as available," without warranty of any kind',
    "broad_warranty_disclaimer",
  );
});

test("account_termination_no_notice accepts a real termination clause", () => {
  pass(
    "Bitwarden has the right to suspend or terminate your access to all or any part of the Website at any time",
    "account_termination_no_notice",
  );
});

test("governing_law_distant_venue accepts an exclusive-venue clause", () => {
  pass(
    "You and Bitwarden agree to submit to the exclusive jurisdiction and venue of the courts located in California",
    "governing_law_distant_venue",
  );
});

test("services_as_is accepts AS IS", () => {
  pass('Our Services are provided on "as is" basis', "services_as_is");
});

test("services_as_is rejects a deletion clause", () => {
  reject("You may delete your account at any time", "services_as_is");
});

test("explicit_refund_window accepts a 30-day refund", () => {
  pass("We offer a 30 day refund policy on all paid Services.", "explicit_refund_window", "credit");
});

test("explicit_refund_window rejects an unrelated clause", () => {
  reject("You agree to these terms", "explicit_refund_window", "credit");
});

test("easy_account_deletion accepts self-serve deletion", () => {
  pass(
    "You can delete your account at any time by going into your web vault Settings",
    "easy_account_deletion",
    "credit",
  );
});

test("user_retains_content_ownership accepts an ownership statement", () => {
  pass(
    "You retain ownership of any content you post on the platform.",
    "user_retains_content_ownership",
    "credit",
  );
});

test("transparent_retention_period accepts a numeric retention", () => {
  pass(
    "We retain billing data for 12 months and delete it thereafter.",
    "transparent_retention_period",
    "credit",
  );
});

test("transparent_retention_period rejects a vague retention", () => {
  reject("We retain data as long as necessary.", "transparent_retention_period", "credit");
});

test("other_unfavourable_clause accepts anything (escape hatch)", () => {
  pass("This is a random clause.", "other_unfavourable_clause");
});

test("unknown category falls through to accept (no false-rejection)", () => {
  pass("Anything goes for unknown ids.", "completely_made_up_category");
});
