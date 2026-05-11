import { test } from "node:test";
import assert from "node:assert/strict";
import { extract, MAX_WORDS } from "../extension/src/pipeline/steps/extract.js";

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

test("extract throws when input has no document text", async () => {
  await assert.rejects(() => extract({ tosText: "   " }, {}), /no document text to analyse/);
});

test("extract keeps a short document under MAX_WORDS in full", async () => {
  const para1 = "We may terminate your account at any time at our sole discretion without notice";
  const para2 = "You agree to indemnify and hold us harmless from any claim arising out of your use";
  const para3 = "Refunds are available within thirty days of purchase for any reason";
  const tosText = [`${para1}.`, `${para2}.`, `${para3}.`].join("\n\n");

  const { value } = await extract({ tosText }, {});
  assert.ok(value.extractedText.includes(para1), "para1 must be kept");
  assert.ok(value.extractedText.includes(para2), "para2 must be kept");
  assert.ok(value.extractedText.includes(para3), "para3 must be kept");
  assert.ok(value.extractedWords > 0);
  assert.ok(value.extractedWords <= MAX_WORDS);
});

test("extract respects MAX_WORDS budget for large documents", async () => {
  const blocks = [];
  for (let i = 0; i < 200; i += 1) {
    blocks.push(
      `We may terminate your account at any time at our sole discretion without notice. This is block ${i} with extra filler words to push paragraph length over the minimum filter so the paragraph is not dropped during extraction.`,
    );
  }
  const tosText = blocks.join("\n\n");

  const { value } = await extract({ tosText }, {});
  const words = wordCount(value.extractedText);
  assert.ok(
    words <= MAX_WORDS,
    `extract should stay within MAX_WORDS=${MAX_WORDS}, got ${words}`,
  );
  assert.ok(words >= MAX_WORDS * 0.5, `extract should fill at least half of budget, got ${words}`);
});

test("extract preserves original document order in output", async () => {
  const para1 =
    "Section one talks about your account creation and minor user data retention policies for verification.";
  const para2 =
    "Section two: We may terminate your account at any time at our sole discretion without prior notice.";
  const para3 =
    "Section three discusses general support hours and contact information for product questions.";
  const para4 =
    "Section four: You waive any right to participate in a class action lawsuit against the service.";
  const para5 =
    "Section five describes optional premium tiers and their associated billing characteristics.";

  const tosText = [para1, para2, para3, para4, para5].join("\n\n");
  const { value } = await extract({ tosText }, {});

  const idx2 = value.extractedText.indexOf("Section two");
  const idx4 = value.extractedText.indexOf("Section four");
  assert.ok(idx2 >= 0 && idx4 >= 0, "both risky sections must survive");
  assert.ok(idx2 < idx4, "extracted text must preserve original document order");
});

test("extract performs structural sampling so end of document is not lost", async () => {
  const riskyHead = [];
  for (let i = 0; i < 40; i += 1) {
    riskyHead.push(
      `Risk clause ${i}: We may terminate your account at our sole discretion without notice and without liability for damages.`,
    );
  }
  const neutralMiddle = [];
  for (let i = 0; i < 40; i += 1) {
    neutralMiddle.push(
      `Middle paragraph ${i} containing only neutral product description text with absolutely no legalese to trigger risk scoring at all.`,
    );
  }
  const tailRiskyMarker =
    "TAILMARKERUNIQ This final tail paragraph contains a class action waiver clause: you waive any right to participate in a class-wide proceeding.";
  const tosText = [...riskyHead, ...neutralMiddle, tailRiskyMarker].join("\n\n");

  const { value } = await extract({ tosText }, {});
  assert.ok(
    value.extractedText.includes("TAILMARKERUNIQ"),
    "structural sampling should retain a representative paragraph from the document tail",
  );
});

test("extract falls back gracefully when no paragraphs trip the keyword filter", async () => {
  const blocks = [];
  for (let i = 0; i < 20; i += 1) {
    blocks.push(
      `Generic neutral product description ${i} about pleasant features and friendly user experience.`,
    );
  }
  const tosText = blocks.join("\n\n");

  const { value } = await extract({ tosText }, {});
  assert.ok(value.extractedText.length > 0, "fallback path must still emit text");
  assert.ok(value.extractedWords > 0);
});

test("extract bumped MAX_WORDS to at least 2000 to give Gemini Nano more context", () => {
  assert.ok(MAX_WORDS >= 2000, `MAX_WORDS should be >= 2000 for large ToS coverage, got ${MAX_WORDS}`);
});

test("extract is robust against missing tosText", async () => {
  await assert.rejects(() => extract({}, {}), /no document text to analyse/);
  await assert.rejects(() => extract({ tosText: null }, {}), /no document text to analyse/);
});
