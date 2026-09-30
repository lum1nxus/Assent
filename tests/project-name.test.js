import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = join(repoRoot, "extension");
const retiredNamePattern = /assent/i;
const textFilePattern = /\.(js|json|html|css)$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listExtensionTextFiles() {
  return readdirSync(extensionRoot, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && textFilePattern.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

test("extension display name is AtoF", () => {
  const messages = readJson(join(extensionRoot, "_locales/en/messages.json"));
  assert.equal(messages.extName.message, "AtoF");
});

test("package slug is atof", () => {
  assert.equal(readJson(join(repoRoot, "package.json")).name, "atof");
  const lock = readJson(join(repoRoot, "package-lock.json"));
  assert.equal(lock.name, "atof");
  assert.equal(lock.packages[""].name, "atof");
});

test("extension sources do not use the retired project name", () => {
  const filesWithRetiredName = listExtensionTextFiles()
    .filter((path) => retiredNamePattern.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(repoRoot.length + 1));
  assert.deepEqual(filesWithRetiredName, []);
});
