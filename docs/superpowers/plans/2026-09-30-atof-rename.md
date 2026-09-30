# Rename Assent to AtoF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project from Assent to AtoF in the GitHub repo, the extension, packaging, docs, and rules, with no behaviour change.

**Architecture:** Pure rename. The GitHub repo is renamed first so every new URL resolves from the first commit. A guard test pins the display name and slug and fails if the retired name reappears anywhere under `extension/`. Docs and rules follow in a separate commit.

**Tech Stack:** Vanilla JS ESM Chrome MV3 extension, `node:test`, ESLint 9, Prettier 3, `gh` CLI.

Spec: `docs/superpowers/specs/2026-09-30-atof-rename-design.md`

## Global Constraints

- Display name `AtoF`; slug `atof`; GitHub repo `lum1nxus/atof`; new base URL `https://github.com/lum1nxus/atof`.
- No change to pipeline logic, rubric, scoring, or behaviour. In `persist.js` only the `methodology_url` string changes; `not_legal_advice` and `not_affiliated` stay.
- No code comments. ASCII punctuation in every line you write or edit. Existing non-ASCII punctuation on lines you do not otherwise edit stays.
- No real brand names in new text, test titles, or commit messages.
- `docs/superpowers/specs/2026-09-30-atof-dev-reboot-design.md` is not edited.
- Branch `chore/rename-atof` (already exists, holds the spec commit). PR title: `chore: rename project to AtoF`.
- Gate before every commit: `npm test && npm run lint && npm run format:check`.

## File map

| File                                      | Change                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| GitHub repo, `origin` remote              | `Assent` to `atof`                                      |
| `tests/project-name.test.js`              | Create: guard test for name, slug, retired name         |
| `extension/_locales/en/messages.json`     | 8 messages                                              |
| `extension/src/sidepanel/sidepanel.js`    | URL, fallbacks, footer, debug bundle name               |
| `extension/src/sidepanel/index.html`      | Header title                                            |
| `extension/onboarding.js`                 | Fallbacks                                               |
| `extension/onboarding.html`               | Heading                                                 |
| `extension/src/background.js`             | Log prefix, error message                               |
| `extension/src/content.js`                | CSS classes, ids, keyframes, data attribute, log prefix |
| `extension/src/features/donation.js`      | Storage key                                             |
| `extension/src/pipeline/steps/persist.js` | `methodology_url`                                       |
| `package.json`, `package-lock.json`       | Name, URLs, zip script                                  |
| `.gitignore`                              | Zip pattern                                             |
| `README.md`, `PRIVACY.md`, `TESTING.md`   | Name, URLs, zip name; README gets "Formerly named"      |
| `CHANGELOG.md`                            | New Changed entry, one mention                          |
| `TODO.md`, `scripts/capture.md`           | Name, store URL                                         |
| `.cursor/rules/*.mdc`                     | `description` frontmatter                               |

---

### Task 1: Rename the GitHub repo and the remote

**Files:** none in the tree.

**Interfaces:**

- Produces: `origin` = `https://github.com/lum1nxus/atof.git`; URL `https://github.com/lum1nxus/atof` resolves. Tasks 2 and 3 write this URL.

- [ ] **Step 1: Confirm the current state**

Run: `gh repo view lum1nxus/Assent --json name,url`
Expected: `{"name":"Assent","url":"https://github.com/lum1nxus/Assent"}`

- [ ] **Step 2: Rename the repo**

Run: `gh repo rename atof --repo lum1nxus/Assent --yes`
Expected: `Renamed repository lum1nxus/atof`

- [ ] **Step 3: Point `origin` at the new URL**

Run: `git remote set-url origin https://github.com/lum1nxus/atof.git && git remote -v`
Expected: both fetch and push lines show `https://github.com/lum1nxus/atof.git`.

- [ ] **Step 4: Verify the new URL and the redirect**

Run: `gh repo view lum1nxus/atof --json name,url && git fetch origin && curl -sI https://github.com/lum1nxus/Assent | head -3`
Expected: name `atof`; fetch succeeds; curl shows `HTTP/2 301` with `location: https://github.com/lum1nxus/atof`.

No commit: nothing in the tree changes.

---

### Task 2: Rename in the extension and packaging, guarded by a test

**Files:**

- Create: `tests/project-name.test.js`
- Modify: `extension/_locales/en/messages.json`, `extension/src/sidepanel/sidepanel.js`, `extension/src/sidepanel/index.html`, `extension/onboarding.js`, `extension/onboarding.html`, `extension/src/background.js`, `extension/src/content.js`, `extension/src/features/donation.js`, `extension/src/pipeline/steps/persist.js`, `package.json`, `package-lock.json`, `.gitignore`

**Interfaces:**

- Consumes: repo URL `https://github.com/lum1nxus/atof` from Task 1.
- Produces: storage key `atof_donation_state`; DOM names `atof-hl`, `atof-pulse`, `atof-spin`, `atof-floating-pill`, `atof-close`, `data-atof`; debug bundle name `atof-debug`; zip `atof-<version>.zip`. The Layer 3 check in Task 4 looks for these.

- [ ] **Step 1: Write the failing test**

Create `tests/project-name.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/project-name.test.js`
Expected: 3 failing tests. The first fails because `"Assent" !== "AtoF"`, the second because `"assent" !== "atof"`, and the third lists 9 files under `extension/`.

- [ ] **Step 3: Locale messages**

In `extension/_locales/en/messages.json` replace the word `Assent` with `AtoF` in these 8 messages, leaving every other character unchanged:

- `extName`: `"AtoF"`
- line 33: `"AtoF needs a quick one-time setup before it can analyse pages."`
- line 39: `"... Allow AtoF to read any page you choose to scan. ..."`
- line 78: `"... AtoF currently analyses English-language documents only. ..."`
- line 96: `"AtoF could not access this page. Click the AtoF icon on the toolbar, then press Scan this page."`
- line 291: `"Set up AtoF"`
- line 294: `"AtoF analyses agreement documents entirely on your device ..."`
- line 348: `"AtoF needs desktop Chrome 148 or newer ..."`

- [ ] **Step 4: Side panel**

`extension/src/sidepanel/sidepanel.js`:

```js
const METHODOLOGY_URL = "https://github.com/lum1nxus/atof#methodology";
```

```js
document.title = t("extName", "AtoF");
headerTitle.textContent = t("extName", "AtoF");
```

```js
<span class="footer-version">AtoF v${esc(EXTENSION_VERSION)}</span>
```

```js
bundle = { name: "atof-debug" };
```

```js
a.download = `${bundle.name ?? "atof-debug"}.json`;
```

```js
      ${esc(t("sidepanelSetupNeeded", "AtoF needs a quick one-time setup before it can analyse pages."))}
```

`extension/src/sidepanel/index.html` line 602:

```html
<div class="header-title" id="header-title">AtoF</div>
```

- [ ] **Step 5: Onboarding**

`extension/onboarding.js`:

```js
document.getElementById("brand-title").textContent = t("extName", "AtoF");
```

```js
document.title = t("onbTitle", "Set up AtoF");
```

`extension/onboarding.html` line 256:

```html
<h1 id="brand-title">AtoF</h1>
```

- [ ] **Step 6: Background**

`extension/src/background.js`: lines 42 and 333 become `console.error("[AtoF]", err);`. Line 151 becomes:

```js
"AtoF could not access this page. Click the AtoF icon on the toolbar, then press Scan this page.";
```

- [ ] **Step 7: Content script**

`extension/src/content.js`, all 17 occurrences:

- `"assent-hl"` to `"atof-hl"` (line 200), `mark.assent-hl` to `mark.atof-hl` (lines 214, 242), `mark.className = "atof-hl"` (line 442)
- `style.setAttribute("data-atof", "highlight-style")` (line 207)
- `assent-pulse` to `atof-pulse` (lines 220, 222)
- `"[Assent] highlight: ..."` to `"[AtoF] highlight: ..."` (lines 267, 273, 312)
- `OVERLAY_ID = "atof-floating-pill"` (line 485)
- `assent-spin` to `atof-spin` (lines 558, 560)
- `id="assent-close"` to `id="atof-close"` and `e.target.id === "atof-close"` (lines 617, 620, 630, 633)

- [ ] **Step 8: Donation key and persisted methodology URL**

`extension/src/features/donation.js` line 12:

```js
const KEY = "atof_donation_state";
```

`extension/src/pipeline/steps/persist.js` line 44:

```js
      methodology_url: "https://github.com/lum1nxus/atof#methodology",
```

- [ ] **Step 9: Packaging**

`package.json`:

```json
  "name": "atof",
```

```json
  "homepage": "https://github.com/lum1nxus/atof",
```

```json
    "url": "git+https://github.com/lum1nxus/atof.git"
```

```json
    "zip": "rm -f atof-*.zip && cd extension && zip -r ../atof-${npm_package_version}.zip . -x '*.DS_Store' '*/.DS_Store'"
```

`package-lock.json` lines 2 and 8: `"name": "atof",`.

`.gitignore` line 12: `atof-*.zip`.

- [ ] **Step 10: Run the guard test**

Run: `node --test tests/project-name.test.js`
Expected: 3 passing tests.

- [ ] **Step 11: Confirm no stray matches and run the full gate plus eval**

Run: `rg -i assent extension package.json package-lock.json .gitignore; npm test && npm run lint && npm run format:check && npm run eval`
Expected: `rg` prints nothing; 190 tests pass (187 + 3); lint and format clean; eval reports the same results as on `main` (the only pipeline edit is a URL string).

- [ ] **Step 12: Commit**

```bash
git add tests/project-name.test.js extension package.json package-lock.json .gitignore
git commit -m "chore: rename extension and package to AtoF"
```

---

### Task 3: Rename in docs and rules

**Files:**

- Modify: `README.md`, `PRIVACY.md`, `TESTING.md`, `CHANGELOG.md`, `TODO.md`, `scripts/capture.md`, `.cursor/rules/testing.mdc`, `.cursor/rules/pipeline-and-rubric.mdc`, `.cursor/rules/legal-posture.mdc`, `.cursor/rules/code-style.mdc`, `.cursor/rules/chrome-extension.mdc`

**Interfaces:**

- Consumes: repo URL from Task 1; zip name `atof-<version>.zip` and debug bundle name `atof-debug` from Task 2.

- [ ] **Step 1: README**

Replace the title and add the former-name line so the top reads:

```markdown
# AtoF

Formerly named Assent.

> Reads agreement documents so you don't have to. Highlights potentially unfavourable clauses before you accept.
```

In the rest of `README.md` replace `Assent` with `AtoF` (lines 5, 13, 17, 20, 54, 88, 189, 266) and `assent-<version>.zip` with `atof-<version>.zip` (line 256). Line 20 is inside an aligned code block: after renaming, re-pad so the text after it keeps the same column as the lines around it.

- [ ] **Step 2: PRIVACY**

In `PRIVACY.md` replace every `Assent` with `AtoF` and `https://github.com/lum1nxus/Assent/issues` with `https://github.com/lum1nxus/atof/issues` (lines 5 and 126). The title becomes `# Privacy Policy for AtoF`. The effective date stays.

- [ ] **Step 3: TESTING and capture notes**

`TESTING.md`: `Assent` to `AtoF` on lines 1, 3, 49 (`AtoF v0.4.0`), 164, 170, 172, 227; `assent-debug-<...>.json` to `atof-debug-<...>.json` (line 69); `assent-<version>.zip` to `atof-<version>.zip` (line 266).

`scripts/capture.md` line 13: `chrome://extensions -> AtoF -> Service worker -> Inspect`.

- [ ] **Step 4: TODO**

`TODO.md` line 195: `https://github.com/lum1nxus/atof/blob/main/PRIVACY.md`. Lines 238, 267, 296: `Assent` to `AtoF`.

- [ ] **Step 5: CHANGELOG**

In `CHANGELOG.md`, directly under `## [Unreleased]` and before `### Added`, insert:

```markdown
### Changed

- **Project renamed from Assent to AtoF.** The extension name, side panel, onboarding,
  in-page pill, privacy policy, and repository URL now use AtoF. Old repository links
  redirect to the new one.
```

On line 18 change `Chrome's (not Assent's) role` to `Chrome's (not AtoF's) role`.

- [ ] **Step 6: Rules frontmatter**

In each `.cursor/rules/*.mdc` listed above, change `for Assent` to `for AtoF` in the `description` line only.

- [ ] **Step 7: Confirm the only remaining matches**

Run: `rg -i -l assent --hidden -g '!.git' -g '!node_modules' -g '!.superpowers'`
Expected exactly these files:

```
CHANGELOG.md
README.md
docs/superpowers/specs/2026-09-30-atof-dev-reboot-design.md
docs/superpowers/specs/2026-09-30-atof-rename-design.md
docs/superpowers/plans/2026-09-30-atof-rename.md
tests/project-name.test.js
```

Then `rg -n -i assent CHANGELOG.md README.md` must show only the new Changed entry and the `Formerly named Assent.` line. `tests/project-name.test.js` holds the retired-name pattern on purpose.

- [ ] **Step 8: Gate and commit**

Run: `npm run format && npm test && npm run lint && npm run format:check`
Expected: 190 tests pass; lint and format clean.

```bash
git add README.md PRIVACY.md TESTING.md CHANGELOG.md TODO.md scripts/capture.md .cursor/rules
git commit -m "docs: rename project to AtoF in docs and rules"
```

---

### Task 4: Layer 3 check in real Chrome and PR

**Files:** none, unless the check finds a defect. A defect goes back through Task 2 with a fix commit.

**Interfaces:**

- Consumes: everything from Tasks 1-3.

- [ ] **Step 1: Hand over to the user**

Ask the user to open `chrome://extensions`, remove the old unpacked entry if present, click Load unpacked, pick `~/repos/atof/extension`, pin the extension, open an agreement page (any fixture or real terms page), and hand over the tab to the `chrome-devtools` MCP.

- [ ] **Step 2: Drive and check**

With `chrome-devtools` MCP:

- `chrome://extensions` shows the name `AtoF`; the toolbar tooltip shows `AtoF`.
- Open the side panel: header title and `document.title` are `AtoF`; the footer shows `AtoF v0.4.0`.
- Press Scan this page: the in-page pill appears (`document.getElementById("atof-floating-pill")` is not null during the scan) and the result renders.
- Click a flag: the quote is highlighted; `document.querySelectorAll("mark.atof-hl").length > 0` and `document.querySelector('style[data-atof="highlight-style"]')` is not null.
- Console messages from the extension, if any, use the `[AtoF]` prefix; no new errors appear compared with `main`.
- The Methodology link points at `https://github.com/lum1nxus/atof#methodology`.
- Open the onboarding page (`chrome-extension://<id>/onboarding.html`): the heading is `AtoF` and the tab title is `Set up AtoF`.
- Take a screenshot of the side panel and the onboarding page for the PR.

If the user is not available, report the Layer 3 check as pending and do not claim the change is done.

- [ ] **Step 3: Final gate**

Run: `npm test && npm run lint && npm run format:check && npm run eval`
Expected: all pass. Show the output.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin chore/rename-atof
gh pr create --base main --title "chore: rename project to AtoF" --body "Renames the project from Assent to AtoF per docs/superpowers/specs/2026-09-30-atof-rename-design.md. No behaviour change. The GitHub repo is already renamed; old links redirect."
```

Then use `superpowers:finishing-a-development-branch`.
