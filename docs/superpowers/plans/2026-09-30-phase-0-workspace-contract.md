# Phase 0: Environment and Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make every future agent session in this repo follow the Superpowers cycle and the repo's own conventions without being reminded, and make the tooling gate complete (tests in CI, Node 24, lint over every JS file).

**Architecture:** A root `AGENTS.md` is the single workflow entry point and replaces `docs/HANDOFF.md`. A new always-applied rule `superpowers-discipline.mdc` enforces the gating. `testing.mdc` gains Layer 3 details and the gate commands. CI runs tests on Node 24. ESLint config covers `extension/`, `tests/`, and `scripts/`. No extension behaviour changes.

**Tech Stack:** Markdown, Cursor `.mdc` rules, GitHub Actions, Node 24, `node:test`, ESLint 9 flat config, Prettier 3.

**Spec:** `docs/superpowers/specs/2026-09-30-atof-dev-reboot-design.md`

## Global Constraints

- ASCII punctuation only in new or edited lines: hyphens instead of em/en dashes, straight quotes, `...` instead of an ellipsis character. Existing lines in `TODO.md` that are not edited keep their current punctuation.
- No brand or company names beyond what `README.md` already uses for the platform (Chrome, GitHub).
- Every touched Markdown and JS file must pass `npm run format:check` (Prettier 3, config in `.prettierrc`). Run the formatter, do not hand-align tables.
- Conventional Commits. No ticket ids.
- No changes to any file under `extension/`, `tests/`, or `scripts/`.
- All tasks run on the existing branch `chore/dev-reboot`, which is based on `origin/chore/mvp-hardening`.
- Non-ASCII check command (macOS `grep` has no `-P`): `rg -n '[^\x00-\x7F]' <files>`. Expected: no output, exit code 1.

---

### Task 1: Operating contract

**Files:**

- Create: `AGENTS.md`
- Create: `.cursor/rules/superpowers-discipline.mdc`
- Delete: `docs/HANDOFF.md`
- Modify: `TODO.md` (P0-1 section, first paragraph)

**Interfaces:**

- Consumes: nothing.
- Produces: gate command string `npm test && npm run lint && npm run format:check`, referenced verbatim by Task 2.

- [x] **Step 1: Create `AGENTS.md`**

```markdown
# Agent guide

Chrome MV3 extension that grades agreement documents A-F on-device.

- `README.md` - pipeline, permissions, privacy model.
- `TODO.md` - the backlog. The "Pre-release fix plan" section is ordered P0 / P1 / P2 and is the source of what to work on next.
- `TESTING.md` - manual testing in real Chrome.
- `PRIVACY.md` - the published privacy policy. Code must never contradict it.

## This repo overrides user-level conventions

This is a personal project. Any user-level rule about ticket ids, Jira, choosing between `dev` / `preprod` base branches, or infrastructure does not apply here.

- Base branch: `main`. Do not ask which base branch to use.
- Branch names: `<type>/<short-change>`, for example `feat/scan-progress`.
- Commits and PR titles: Conventional Commits, for example `feat: narrate scan progress`.
- Allowed types: `feat`, `fix`, `chore`, `build`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, `revert`.
- Node version: see `.nvmrc`.

## Workflow

Every change goes through the Superpowers cycle. Do not skip steps because a change looks small.

1. `superpowers:brainstorming` - agree on the design with the user. Bugs start with `superpowers:systematic-debugging` instead. If `TODO.md` already records an approved design for the item, go straight to step 3.
2. Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and committed.
3. `superpowers:writing-plans` - plan saved to `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` and committed.
4. `superpowers:subagent-driven-development` (preferred) or `superpowers:executing-plans`, on a feature branch, with `superpowers:test-driven-development` for code.
5. `superpowers:verification-before-completion` - run the gate and show its output before claiming anything is done.
6. `superpowers:finishing-a-development-branch` - merge or open a PR. When an item from `TODO.md` is finished, mark it done there in the same branch.

## Verification gate

Always:

    npm test && npm run lint && npm run format:check

Also required when the change touches:

- `extension/src/pipeline/**`: `npm run eval`
- side panel, content script, onboarding, or manifest: a Layer 3 check in real Chrome (see `.cursor/rules/testing.mdc`)

## Where the rules live

- `.cursor/rules/code-style.mdc` - no comments, ASCII punctuation, ESM only.
- `.cursor/rules/legal-posture.mdc` - no brand names, mandatory disclaimers.
- `.cursor/rules/chrome-extension.mdc` - MV3 permissions, CSP, messaging, accessibility.
- `.cursor/rules/pipeline-and-rubric.mdc` - closed taxonomy, deterministic scoring, classifier-verifier.
- `.cursor/rules/testing.mdc` - test layers, fixtures, gate.
- `.cursor/rules/superpowers-discipline.mdc` - workflow gating.
```

- [x] **Step 2: Create `.cursor/rules/superpowers-discipline.mdc`**

```markdown
---
description: Workflow gating for every change in this repo.
alwaysApply: true
---

# Superpowers discipline

- Read `AGENTS.md` at the start of every session. It overrides user-level workflow rules.
- No edits under `extension/`, `tests/`, or `scripts/` until a spec in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/` exist for the change and the user has approved both. An approved design recorded in `TODO.md` counts as the spec.
- Bug fixes start with `superpowers:systematic-debugging`. The regression fixture or test lands in the same commit as the fix.
- Implementation happens on a feature branch, never directly on `main`.
- Never claim a task is done, fixed, or passing without running the verification gate from `AGENTS.md` in the same turn and showing its result.
- If the user asks to skip a step, confirm once, then follow the user.
```

- [x] **Step 3: Move the one unique HANDOFF note into `TODO.md` and delete `docs/HANDOFF.md`**

In `TODO.md`, section `### P0-1: what is already done, and the approved design for the rest`, find:

```markdown
The capability-regression route is fixed (the background writes `setup_needed`, the panel renders
its existing "Open setup" card). The rest of P0-1 was designed and reviewed but not yet written:
```

Replace with:

```markdown
The capability-regression route is fixed (the background writes `setup_needed`, the panel renders
its existing "Open setup" card). It has not been tested in a real browser yet: reproducing it
requires the model capability to regress between the panel's check and the background's. The rest
of P0-1 was designed and reviewed but not yet written:
```

Then run: `git rm docs/HANDOFF.md`

- [x] **Step 4: Format and verify**

Run: `npx prettier --write AGENTS.md TODO.md && npm run format:check`
Expected: `All matched files use Prettier code style!`

Run: `rg -n '[^\x00-\x7F]' AGENTS.md .cursor/rules/superpowers-discipline.mdc`
Expected: no output, exit code 1.

Run: `rg -n 'HANDOFF' --glob '!docs/superpowers/**' .`
Expected: no output, exit code 1.

- [x] **Step 5: Commit**

```bash
git add AGENTS.md .cursor/rules/superpowers-discipline.mdc TODO.md
git commit -m "docs: add agent guide and superpowers workflow rule"
```

---

### Task 2: Layer 3 and gate in `testing.mdc`

**Files:**

- Modify: `.cursor/rules/testing.mdc` (the `- **Layer 3 - real Chrome end-to-end**` bullet, plus a new `## Gate` section right after it)
- Modify: `.prettierignore`

**Interfaces:**

- Consumes: gate command from Task 1.
- Produces: nothing used by later tasks.

- [x] **Step 1: Replace the Layer 3 bullet**

Old:

```markdown
- **Layer 3 - real Chrome end-to-end**: manual, slow, only when you need to verify the live on-device model. See `TESTING.md`. Debug bundles from real sessions can be replayed offline with `npm run replay <bundle.json>`.
```

New:

```markdown
- **Layer 3 - real Chrome end-to-end**: verifies the extension in a real browser.
  - Interactive: load `extension/` unpacked and use the `chrome-devtools` MCP to drive the page, read the service-worker and page consoles, inspect `chrome.storage.session`, and take screenshots. Follow the manual checklist in `TESTING.md`.
  - Automated: planned for Phase 1 (Chrome for Testing + Chrome DevTools Protocol). Until it exists, the interactive check is required for UI changes.
  - Debug bundles from real sessions can be replayed offline with `npm run replay <bundle.json>`; a reproduced bug becomes a Layer 2 fixture.

## Gate

- Every commit: `npm test && npm run lint && npm run format:check`.
- Changes under `extension/src/pipeline/**`: also `npm run eval`.
- Changes to the side panel, content script, onboarding, or manifest: also a Layer 3 check.
```

- [x] **Step 2: Keep subagent scratch files out of the format gate**

The Superpowers subagent workflow writes Markdown scratch files under `.superpowers/` (git-ignored by the root `.gitignore`), and `npm run format:check` currently fails on them. Append one line to `.prettierignore`:

```text
.superpowers
```

- [x] **Step 3: Verify**

Prettier has no parser for `.mdc`, and `format:check` does not cover `.mdc` files, so rule files are not passed to Prettier.

Run: `npm run format:check`
Expected: `All matched files use Prettier code style!`

Run: `rg -n '[^\x00-\x7F]' .cursor/rules/testing.mdc`
Expected: no output, exit code 1.

- [x] **Step 4: Commit**

```bash
git add .cursor/rules/testing.mdc .prettierignore
git commit -m "docs: describe layer 3 browser testing and commit gate"
```

---

### Task 3: Node 24 and tests in CI (audit P0-7)

**Files:**

- Create: `.nvmrc`
- Modify: `package.json` (add `engines`)
- Modify: `.github/workflows/ci.yml` (job `lint-and-format`)
- Modify: `TODO.md` (P0 item 7)

**Interfaces:**

- Consumes: `npm test` script from `package.json`.
- Produces: nothing.

- [x] **Step 1: Create `.nvmrc`**

Content (single line, trailing newline):

```text
24
```

- [x] **Step 2: Add `engines` to `package.json`**

Insert after the `"license": "MIT",` line:

```json
  "engines": {
    "node": ">=24"
  },
```

- [x] **Step 3: Update `.github/workflows/ci.yml` job `lint-and-format`**

Change `name: Lint + format + audit` to `name: Test + lint + format + audit`.

Change the setup step to read the version from `.nvmrc`:

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version-file: .nvmrc
    cache: npm
```

Add a test step between "Install dependencies" and "Lint":

```yaml
- name: Test
  run: npm test
```

- [x] **Step 4: Mark P0-7 done in `TODO.md`**

Find the item that starts with `7. **CI does not run the tests.**` (three lines, ending with `job is redundant while \`en\` is the only locale.`) and replace the whole item with:

```markdown
7. **Done - CI runs the tests.** `npm test` runs in CI on Node 24 (version from `.nvmrc`). The
   locale-parity job is kept: it costs nothing and matters as soon as a second locale lands.
```

- [x] **Step 5: Verify**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"`
Expected: `ok`

Run: `node -e "const p=require('./package.json'); if(p.engines.node!=='>=24') process.exit(1); console.log('ok')"`
Expected: `ok`

Run: `npm test 2>&1 | rg '^. (pass|fail) '`
Expected: `pass 187` and `fail 0`

Run: `npx prettier --write TODO.md package.json && npm run format:check`
Expected: `All matched files use Prettier code style!`

- [x] **Step 6: Commit**

```bash
git add .nvmrc package.json .github/workflows/ci.yml TODO.md
git commit -m "ci: run tests on node 24"
```

---

### Task 4: Lint every JS file

**Files:**

- Modify: `eslint.config.mjs`
- Modify: `package.json` (`lint` script)
- Modify: `TODO.md` (P1 item "ESLint does not cover the root entrypoints")

**Interfaces:**

- Consumes: nothing.
- Produces: `npm run lint` covering `extension`, `tests`, `scripts`.

- [x] **Step 1: Widen the browser block in `eslint.config.mjs`**

Old:

```js
    files: ["extension/src/**/*.js"],
```

New:

```js
    files: ["extension/**/*.js"],
```

- [x] **Step 2: Add scripts to the Node block**

Old:

```js
    files: ["tests/**/*.js"],
```

New:

```js
    files: ["tests/**/*.js", "scripts/**/*.mjs"],
```

- [x] **Step 3: Update the `lint` script in `package.json`**

Old:

```json
    "lint": "eslint extension/src tests",
```

New:

```json
    "lint": "eslint extension tests scripts",
```

- [x] **Step 4: Run lint**

Run: `npm run lint`
Expected: exits 0 with no problems reported. A probe with exactly this scope on 2026-09-30 reported zero errors. If errors appear, stop and report them; do not edit files under `extension/` or `scripts/` in this task.

- [x] **Step 5: Mark the ESLint item done in `TODO.md`**

Find the P1 bullet that starts with `- **ESLint does not cover the root entrypoints.**` (three lines, ending with `eleven false-positive globals errors.`) and replace it with:

```markdown
- **Done - ESLint covers every JS file.** `npm run lint` now lints `extension`, `tests`, and
  `scripts`. The empty `catch {}` blocks in `onboarding.js` pass because the config allows empty
  catches; whether they should log is a separate style decision.
```

- [x] **Step 6: Verify and commit**

Run: `npx prettier --write TODO.md eslint.config.mjs package.json && npm run format:check`
Expected: `All matched files use Prettier code style!`

```bash
git add eslint.config.mjs package.json TODO.md
git commit -m "build: lint extension entrypoints and scripts"
```

---

### Task 5: Final verification and hand-off

- [x] **Step 1: Clean install and full gate**

Run: `npm ci && npm test && npm run lint && npm run format:check`
Expected: `fail 0`, no lint problems, `All matched files use Prettier code style!`

- [x] **Step 2: Confirm scope**

Run: `git diff --stat origin/chore/mvp-hardening..HEAD`
Expected: only `AGENTS.md`, `.nvmrc`, `.prettierignore`, `.cursor/rules/superpowers-discipline.mdc`, `.cursor/rules/testing.mdc`, `.github/workflows/ci.yml`, `eslint.config.mjs`, `package.json`, `TODO.md`, `docs/HANDOFF.md` (deleted), and files under `docs/superpowers/`.

- [x] **Step 3: Hand off**

Use `superpowers:finishing-a-development-branch`. `chore/dev-reboot` is stacked on `chore/mvp-hardening`: its PR targets `main` after the `chore/mvp-hardening` PR is merged. Do not push or open PRs without the user's confirmation.
