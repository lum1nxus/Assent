import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripSensitiveTokens,
  extractDomainTokens,
} from "../extension/src/pipeline/rubric/strip-sensitive-tokens.js";

test("extractDomainTokens returns the label without the TLD", () => {
  assert.deepEqual(extractDomainTokens("example.com"), ["example"]);
});

test("extractDomainTokens handles subdomains", () => {
  const tokens = extractDomainTokens("policies.example.co.uk");
  assert.ok(tokens.includes("example"));
  assert.ok(tokens.includes("policies"));
});

test("extractDomainTokens strips www.", () => {
  assert.deepEqual(extractDomainTokens("www.example.com"), ["example"]);
});

test("extractDomainTokens ignores very short labels", () => {
  assert.deepEqual(extractDomainTokens("go.com"), []);
});

test("stripSensitiveTokens replaces label with 'the service'", () => {
  const out = stripSensitiveTokens("Example reserves the right to cancel.", "example.com");
  assert.equal(out, "the service reserves the right to cancel.");
});

test("stripSensitiveTokens is case-insensitive", () => {
  const out = stripSensitiveTokens("EXAMPLE, Example, example - all should go.", "example.com");
  assert.equal(out, "the service, the service, the service - all should go.");
});

test("stripSensitiveTokens strips possessive apostrophe-s", () => {
  const out = stripSensitiveTokens("Example's users must comply.", "example.com");
  assert.equal(out, "the service users must comply.");
});

test("stripSensitiveTokens leaves untouched strings alone", () => {
  const out = stripSensitiveTokens("A perfectly generic sentence.", "example.com");
  assert.equal(out, "A perfectly generic sentence.");
});

test("stripSensitiveTokens returns non-string input verbatim", () => {
  assert.equal(stripSensitiveTokens(null, "example.com"), null);
  assert.equal(stripSensitiveTokens(undefined, "example.com"), undefined);
});

test("stripSensitiveTokens returns str verbatim when domain is empty", () => {
  assert.equal(stripSensitiveTokens("Anything", ""), "Anything");
});
