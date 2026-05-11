import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteMatchesCategoryKeywords,
  creditQuoteIsInverted,
} from "../extension/src/pipeline/steps/category-guards.js";

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

test("mandatory_arbitration rejects an acceptable-use clause", () => {
  reject(
    "You agree that you will not under any circumstances attempt to disrupt or tamper with the servers",
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

test("broad_content_license_irrevocable accepts a real licence grant", () => {
  pass(
    "you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use, modify, and sublicense it",
    "broad_content_license_irrevocable",
  );
});

test("broad_content_license_irrevocable rejects a pure IP-retention clause", () => {
  reject(
    "The provider and its licensors retain ownership of all intellectual property rights",
    "broad_content_license_irrevocable",
  );
});

test("broad_indemnity_from_user accepts standard indemnity language", () => {
  pass("You agree to indemnify us, defend us, and hold us harmless", "broad_indemnity_from_user");
});

test("broad_warranty_disclaimer accepts an AS IS clause", () => {
  pass(
    'The Service is provided "as is" and "as available," without warranty of any kind',
    "broad_warranty_disclaimer",
  );
});

test("account_termination_no_notice accepts a real termination clause", () => {
  pass(
    "We have the right to suspend or terminate your access to all or any part of the Service at any time",
    "account_termination_no_notice",
  );
});

test("governing_law_distant_venue accepts an exclusive-venue clause", () => {
  pass(
    "You agree to submit to the exclusive jurisdiction and venue of the courts located in California",
    "governing_law_distant_venue",
  );
});

test("services_as_is accepts AS IS", () => {
  pass('Our Services are provided on "as is" basis', "services_as_is");
});

test("services_as_is rejects an account-deletion clause", () => {
  reject("You may delete your account at any time", "services_as_is");
});

test("explicit_refund_window accepts a 30-day refund", () => {
  pass("We offer a 30 day refund policy on all paid Services.", "explicit_refund_window", "credit");
});

test("explicit_refund_window rejects an unrelated clause", () => {
  reject("You agree to these terms", "explicit_refund_window", "credit");
});

test("easy_account_deletion accepts a self-serve deletion clause", () => {
  pass(
    "You can delete your account at any time by going into your Settings",
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

test("user_retains_content_ownership rejects a service-side ownership statement", () => {
  reject(
    "The Service or the Service's licensors are the sole owners of all rights to the Service or the content.",
    "user_retains_content_ownership",
    "credit",
  );
});

test("creditQuoteIsInverted catches service-side ownership masquerading as user retention", () => {
  assert.equal(
    creditQuoteIsInverted(
      "The Service or the Service's licensors are the sole owners of all rights to the Service or the content.",
      "user_retains_content_ownership",
    ),
    true,
  );
});

test("creditQuoteIsInverted catches service-initiated account deletion", () => {
  assert.equal(
    creditQuoteIsInverted(
      "We may terminate or delete your account at any time at our sole discretion.",
      "easy_account_deletion",
    ),
    true,
  );
});

test("creditQuoteIsInverted lets a genuine user-side deletion clause through", () => {
  assert.equal(
    creditQuoteIsInverted(
      "You can delete your account at any time from Settings.",
      "easy_account_deletion",
    ),
    false,
  );
});

test("creditQuoteIsInverted catches deemed consent disguised as opt-in", () => {
  assert.equal(
    creditQuoteIsInverted(
      "By using the Service you consent to our processing of your personal data.",
      "explicit_optin_data_sharing",
    ),
    true,
  );
});

test("transparent_retention_period accepts a numeric retention period", () => {
  pass(
    "We retain billing data for 12 months and delete it thereafter.",
    "transparent_retention_period",
    "credit",
  );
});

test("transparent_retention_period rejects a vague retention statement", () => {
  reject("We retain data as long as necessary.", "transparent_retention_period", "credit");
});

test("other_unfavourable_clause accepts anything (escape hatch)", () => {
  pass("This is a generic clause.", "other_unfavourable_clause");
});

test("unknown category falls through to accept (no false rejection)", () => {
  pass("Anything goes for unknown ids.", "completely_made_up_category");
});
