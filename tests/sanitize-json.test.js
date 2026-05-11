import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeJson, parseLooseJson } from "../extension/src/pipeline/steps/sanitize-json.js";

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
  const src = "```json\n{\"a\": 1}\n```";
  assert.deepEqual(parseLooseJson(src), { a: 1 });
});

test("parseLooseJson succeeds where raw JSON.parse fails", () => {
  const src = '{"quote": "first line\nsecond line"}';
  assert.throws(() => JSON.parse(src), /control character/i);
  assert.deepEqual(parseLooseJson(src), { quote: "first line\nsecond line" });
});

test("parseLooseJson regresses the duckduckgo failure mode", () => {
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
    '      "note": "DuckDuckGo says:\nWe do not store personal data."',
    "    }",
    "  ]",
    "}",
  ].join("\n");
  const parsed = parseLooseJson(src);
  assert.equal(parsed.credits.length, 1);
  assert.match(parsed.credits[0].note, /We do not store/);
});
