import { test } from "node:test";
import assert from "node:assert/strict";
import { verify } from "../extension/src/pipeline/steps/verify.js";

function buildVerifier(decisions) {
  return async function mockVerifier(category, quotes) {
    const verdicts = quotes.map((q) => {
      const key = `${category}::${q}`;
      const decision = decisions[key];
      if (decision === undefined) {
        return { match: true, reason: "default mock pass" };
      }
      return typeof decision === "boolean"
        ? { match: decision, reason: decision ? "mock match" : "mock reject" }
        : decision;
    });
    return { verdicts, raw: JSON.stringify({ results: verdicts }) };
  };
}

test("verify drops candidates the verifier rejects", async () => {
  const input = {
    flags: [
      {
        category: "mandatory_arbitration",
        quote: "Any dispute shall be arbitrated",
        severity: "high",
      },
      {
        category: "mandatory_arbitration",
        quote: "You may opt out of arbitration",
        severity: "high",
      },
    ],
    credits: [],
  };
  const decisions = {
    "mandatory_arbitration::Any dispute shall be arbitrated": true,
    "mandatory_arbitration::You may opt out of arbitration": false,
  };
  const { value } = await verify(input, { verifier: buildVerifier(decisions) });
  assert.equal(value.flags.length, 1);
  assert.equal(value.flags[0].quote, "Any dispute shall be arbitrated");
  assert.equal(value.flags[0].verifierReason, "mock match");
});

test("verify drops credits whose quote is service-side ownership masquerading as user ownership", async () => {
  const input = {
    flags: [],
    credits: [
      {
        category: "user_retains_content_ownership",
        quote: "The provider and its licensors are the sole owners of all rights to the content.",
      },
      {
        category: "user_retains_content_ownership",
        quote: "You retain ownership of any content you upload.",
      },
    ],
  };
  const decisions = {
    "user_retains_content_ownership::The provider and its licensors are the sole owners of all rights to the content.": false,
    "user_retains_content_ownership::You retain ownership of any content you upload.": true,
  };
  const { value } = await verify(input, { verifier: buildVerifier(decisions) });
  assert.equal(value.credits.length, 1);
  assert.equal(value.credits[0].quote, "You retain ownership of any content you upload.");
});

test("verify batches verifier calls grouped by category", async () => {
  const calls = [];
  const verifier = async (category, quotes, kind) => {
    calls.push({ category, quoteCount: quotes.length, kind });
    return {
      verdicts: quotes.map(() => ({ match: true, reason: "ok" })),
      raw: "",
    };
  };
  const input = {
    flags: [
      { category: "broad_warranty_disclaimer", quote: "A", severity: "full" },
      { category: "broad_warranty_disclaimer", quote: "B", severity: "full" },
      { category: "mandatory_arbitration", quote: "C", severity: "high" },
    ],
    credits: [],
  };
  await verify(input, { verifier });
  const byCategory = new Map();
  for (const c of calls) {
    byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + c.quoteCount);
  }
  assert.equal(byCategory.get("broad_warranty_disclaimer"), 2);
  assert.equal(byCategory.get("mandatory_arbitration"), 1);
});

test("verify fails open if the verifier throws (keeps candidates with verifierFailed=true)", async () => {
  const verifier = async () => {
    throw new Error("model unavailable");
  };
  const input = {
    flags: [
      {
        category: "mandatory_arbitration",
        quote: "Any dispute shall be arbitrated",
        severity: "high",
      },
    ],
    credits: [],
  };
  const { value } = await verify(input, { verifier });
  assert.equal(value.flags.length, 1);
  assert.equal(value.flags[0].verifierFailed, true);
  assert.match(value.flags[0].verifierReason, /verifier error/);
});

test("verify is a no-op when there are no candidates", async () => {
  let called = false;
  const verifier = async () => {
    called = true;
    return { verdicts: [], raw: "" };
  };
  const { value } = await verify({ flags: [], credits: [] }, { verifier });
  assert.equal(called, false);
  assert.deepEqual(value.flags, []);
  assert.deepEqual(value.credits, []);
});

test("verify records verifier raw responses in _debug for later replay", async () => {
  const verifier = async () => ({
    verdicts: [{ match: true, reason: "ok" }],
    raw: '{"results":[{"match":true,"reason":"ok"}]}',
  });
  const input = {
    flags: [
      {
        category: "mandatory_arbitration",
        quote: "Any dispute shall be arbitrated",
        severity: "high",
      },
    ],
    credits: [],
  };
  const { value } = await verify(input, { verifier });
  const responses = value._debug.verifierResponses;
  assert.ok(responses);
  const key = Object.keys(responses).find((k) => k.startsWith("flag:mandatory_arbitration"));
  assert.ok(key);
  assert.match(responses[key], /results/);
});

test("verify preserves user-friendly fields on accepted candidates", async () => {
  const verifier = async () => ({
    verdicts: [{ match: true, reason: "clearly an arbitration clause" }],
    raw: "",
  });
  const input = {
    flags: [
      {
        category: "mandatory_arbitration",
        id: "mandatory_arbitration",
        title: "Mandatory Arbitration",
        quote: "Any dispute shall be arbitrated",
        severity: "high",
      },
    ],
    credits: [],
  };
  const { value } = await verify(input, { verifier });
  assert.equal(value.flags[0].title, "Mandatory Arbitration");
  assert.equal(value.flags[0].severity, "high");
  assert.equal(value.flags[0].verifierReason, "clearly an arbitration clause");
});
