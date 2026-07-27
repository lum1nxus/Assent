import { test } from "node:test";
import assert from "node:assert/strict";
import {
  looksLikeAgreement,
  detectAgreement,
} from "../extension/src/pipeline/steps/detect-agreement.js";

const TOS_SAMPLE = `
  Terms of Service

  By using this website you agree to these terms and conditions. We may terminate
  or suspend your account at our sole discretion. To the maximum extent permitted
  by law we disclaim all warranties and limit our liability. Any dispute shall be
  resolved by binding arbitration under the governing law of England and Wales.
  You grant us a worldwide, royalty-free licence to your user content.
`;

const PRIVACY_SAMPLE = `
  We collect personal data such as your name and email address. This privacy
  policy explains how we process your information and how long we retain it.
`;

const ARTICLE_SAMPLE = `
  The team scored twice in the second half to secure a dramatic comeback win.
  Supporters celebrated late into the night as the manager praised his players
  for their resilience and effort across a gruelling ninety minutes of football.
  Attention now turns to next weekend's fixture away from home.
`;

const DASHBOARD_SAMPLE = `
  Dashboard Overview Sales Today 1,204 Visitors 8,932 Conversion 3.4% Recent
  Orders Export CSV Filter Settings Profile Log out Notifications New message.
`;

test("recognises a Terms of Service document", () => {
  assert.equal(looksLikeAgreement(TOS_SAMPLE), true);
});

test("recognises a privacy policy via a strong marker", () => {
  assert.equal(looksLikeAgreement(PRIVACY_SAMPLE), true);
});

test("rejects an ordinary news article", () => {
  assert.equal(looksLikeAgreement(ARTICLE_SAMPLE), false);
});

test("rejects an app dashboard", () => {
  assert.equal(looksLikeAgreement(DASHBOARD_SAMPLE), false);
});

test("rejects empty or whitespace-only input", () => {
  assert.equal(looksLikeAgreement(""), false);
  assert.equal(looksLikeAgreement("   \n  "), false);
  assert.equal(looksLikeAgreement(null), false);
  assert.equal(looksLikeAgreement(undefined), false);
});

test("detectAgreement passes agreement text through untouched", async () => {
  const input = { tosText: TOS_SAMPLE, domain: "example.com" };
  const out = await detectAgreement(input, {});
  assert.equal(out.value.notAgreement, undefined);
  assert.equal(out.done, undefined);
  assert.equal(out.value.domain, "example.com");
});

test("detectAgreement short-circuits non-agreement text", async () => {
  const input = { tosText: ARTICLE_SAMPLE, domain: "news.example" };
  const out = await detectAgreement(input, {});
  assert.equal(out.done, true);
  assert.equal(out.value.notAgreement, true);
  assert.equal(out.value.domain, "news.example");
});

test("detectAgreement falls back to extractedText when tosText is absent", async () => {
  const input = { extractedText: TOS_SAMPLE };
  const out = await detectAgreement(input, {});
  assert.equal(out.value.notAgreement, undefined);
});
