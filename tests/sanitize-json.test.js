import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeJson,
  parseLooseJson,
  repairTruncatedJson,
} from "../extension/src/pipeline/steps/sanitize-json.js";

test("sanitizeJson is a no-op for already valid JSON", () => {
  const src = '{"a": "b", "c": [1, 2, 3]}';
  assert.equal(sanitizeJson(src), src);
});

test("sanitizeJson escapes a raw newline inside a string", () => {
  const src = '{"quote": "line one\nline two"}';
  const fixed = sanitizeJson(src);
  assert.equal(fixed, '{"quote": "line one\\nline two"}');
  assert.deepEqual(JSON.parse(fixed), { quote: "line one\nline two" });
});

test("sanitizeJson escapes raw tabs and carriage returns inside strings", () => {
  const src = '{"q": "a\tb\rc"}';
  assert.equal(sanitizeJson(src), '{"q": "a\\tb\\rc"}');
});

test("sanitizeJson keeps whitespace between tokens intact", () => {
  const src = '{\n  "a": "b"\n}';
  assert.equal(sanitizeJson(src), '{\n  "a": "b"\n}');
});

test("sanitizeJson fixes an unknown backslash escape inside a string", () => {
  const src = '{"path": "C:\\X\\Y"}';
  const fixed = sanitizeJson(src);
  assert.deepEqual(JSON.parse(fixed), { path: "C:\\X\\Y" });
});

test("sanitizeJson preserves a valid \\t tab escape", () => {
  const src = '{"q": "a\\tb"}';
  assert.equal(sanitizeJson(src), src);
  assert.deepEqual(JSON.parse(sanitizeJson(src)), { q: "a\tb" });
});

test("sanitizeJson preserves valid unicode escapes", () => {
  const src = '{"s": "\\u00e9"}';
  assert.equal(sanitizeJson(src), src);
  assert.deepEqual(JSON.parse(sanitizeJson(src)), { s: "é" });
});

test("sanitizeJson does not escape control chars outside strings", () => {
  const src = '{\n\t"a": 1\n}';
  assert.equal(sanitizeJson(src), src);
});

test("parseLooseJson strips a markdown fence", () => {
  const src = '```json\n{"a": 1}\n```';
  assert.deepEqual(parseLooseJson(src), { a: 1 });
});

test("parseLooseJson succeeds where raw JSON.parse fails", () => {
  const src = '{"quote": "first line\nsecond line"}';
  assert.throws(() => JSON.parse(src), /control character/i);
  assert.deepEqual(parseLooseJson(src), { quote: "first line\nsecond line" });
});

test("repairTruncatedJson produces parseable JSON when input cuts mid-string", () => {
  const truncated = '{"flags": [{"category": "x", "quote": "this clause is cut';
  const repaired = repairTruncatedJson(truncated);
  assert.doesNotThrow(() => JSON.parse(repaired));
  const parsed = JSON.parse(repaired);
  assert.equal(Array.isArray(parsed.flags), true);
});

test("repairTruncatedJson keeps the last complete entry when next entry is incomplete", () => {
  const truncated =
    '{"flags": [{"category": "a", "quote": "ok one"},{"category": "b", "quote": "ok ';
  const repaired = repairTruncatedJson(truncated);
  const parsed = JSON.parse(repaired);
  const complete = parsed.flags.filter(
    (f) => typeof f.category === "string" && typeof f.quote === "string",
  );
  assert.equal(complete.length, 1);
  assert.equal(complete[0].category, "a");
  assert.equal(complete[0].quote, "ok one");
});

test("parseLooseJson recovers a truncated AI response by repairing it", () => {
  const truncated =
    '{"serviceType": "general_tech", "flags": [{"category": "broad_warranty_disclaimer", "severity": "high", "quote": "THE SERVICE IS PROVIDED AS IS AND WITHOUT WARRANT';
  const parsed = parseLooseJson(truncated);
  assert.equal(parsed.serviceType, "general_tech");
  assert.equal(Array.isArray(parsed.flags), true);
});

test("repairTruncatedJson survives a trailing lone backslash inside string", () => {
  const raw = '{"a": "hello\\';
  const repaired = repairTruncatedJson(raw);
  assert.doesNotThrow(() => JSON.parse(repaired), "must be parseable after repair");
});

test("repairTruncatedJson survives an escaped-quote at the very end", () => {
  const raw = '{"a": "hello\\"';
  const repaired = repairTruncatedJson(raw);
  assert.doesNotThrow(() => JSON.parse(repaired));
});

test("repairTruncatedJson survives truncation inside a \\u unicode escape", () => {
  const raw = '{"a": "he\\u003';
  const repaired = repairTruncatedJson(raw);
  assert.doesNotThrow(() => JSON.parse(repaired));
});

test("repairTruncatedJson short-circuits on already-valid JSON", () => {
  const raw = '{"a": 1, "b": [1, 2, 3]}';
  const repaired = repairTruncatedJson(raw);
  assert.equal(repaired, raw);
});

test("parseLooseJson regresses a control-character failure mode from production", () => {
  const src = [
    "{",
    '  "score": 0,',
    '  "serviceType": "general_tech",',
    '  "summary": "Minimal data collection, transparent practices.",',
    '  "flags": [],',
    '  "credits": [',
    "    {",
    '      "id": "transparent_retention",',
    '      "title": "Transparent retention",',
    '      "note": "Provider statement:\nWe do not store personal data."',
    "    }",
    "  ]",
    "}",
  ].join("\n");
  const parsed = parseLooseJson(src);
  assert.equal(parsed.credits.length, 1);
  assert.match(parsed.credits[0].note, /We do not store/);
});
