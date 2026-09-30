# Phase 0: Workspace and Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every future agent session in this repo follow the Superpowers cycle and the repo's own conventions without being reminded, and enforce the test gate in CI.

**Architecture:** A root `AGENTS.md` is the single workflow entry point. A new always-applied rule `superpowers-discipline.mdc` enforces the gating. `testing.mdc` gains Layer 3 details and the gate commands. CI gains a test job. No extension code changes.

**Tech Stack:** Markdown, Cursor `.mdc` rules, GitHub Actions, Node 20 in CI, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-30-atof-dev-reboot-design.md`

## Global Constraints

- ASCII punctuation only: hyphens instead of em/en dashes, straight quotes, `...` instead of an ellipsis character.
- No brand or company names beyond what `README.md` already uses for the platform (Chrome, GitHub).
- Every Markdown file must pass `npm run format:check` (Prettier 3, config in `.prettierrc`).
- Base branch is `main`. Conventional Commits. No ticket ids.
- No changes under `extension/`, `tests/`, or `scripts/`.
- All tasks run on branch `chore/phase-0-contract`, created from `main` before Task 1: `git switch -c chore/phase-0-contract`.

---

### Task 1: Operating contract (`AGENTS.md` + `superpowers-discipline.mdc`)

**Files:**

- Create: `AGENTS.md`
- Create: `.cursor/rules/superpowers-discipline.mdc`

**Interfaces:**

- Consumes: nothing.
- Produces: gate command string `npm test && npm run lint && npm run format:check`, referenced verbatim by Task 2.

- [ ] **Step 1: Create `AGENTS.md`**

```markdown
# Agent guide

Chrome MV3 extension that grades agreement documents A-F on-device. The pipeline, permissions and privacy model are described in `README.md`. Manual browser testing is described in `TESTING.md`.

## This repo overrides user-level conventions

This is a personal project. Any user-level rule about ticket ids, Jira, choosing between `dev` / `preprod` base branches, or infrastructure does not apply here.

- Base branch: `main`. Do not ask which base branch to use.
- Branch names: `<type>/<short-change>`, for example `feat/scan-progress`.
- Commits and PR titles: Conventional Commits, for example `feat: narrate scan progress`.
- Allowed types: `feat`, `fix`, `chore`, `build`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, `revert`.

## Workflow

Every change goes through the Superpowers cycle. Do not skip steps because a change looks small.

1. `superpowers:brainstorming` - agree on the design with the user. Bugs start with `superpowers:systematic-debugging` instead.
2. Spec saved to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and committed.
3. `superpowers:writing-plans` - plan saved to `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` and committed.
4. `superpowers:subagent-driven-development` (preferred) or `superpowers:executing-plans`, on a feature branch, with `superpowers:test-driven-development` for code.
5. `superpowers:verification-before-completion` - run the gate and show its output before claiming anything is done.
6. `superpowers:finishing-a-development-branch` - merge or open a PR.

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
- `.cursor/rules/testing.mdc` - test layers and fixtures.
- `.cursor/rules/superpowers-discipline.mdc` - workflow gating.
```

- [ ] **Step 2: Create `.cursor/rules/superpowers-discipline.mdc`**

```markdown
---
description: Workflow gating for every change in this repo.
alwaysApply: true
---

# Superpowers discipline

- Read `AGENTS.md` at the start of every session. It overrides user-level workflow rules.
- No edits under `extension/`, `tests/`, or `scripts/` until a spec in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/` exist for the change and the user has approved both.
- Bug fixes start with `superpowers:systematic-debugging`. The regression fixture or test lands in the same commit as the fix.
- Implementation happens on a feature branch, never directly on `main`.
- Never claim a task is done, fixed, or passing without running the verification gate from `AGENTS.md` in the same turn and showing its result.
- If the user asks to skip a step, confirm once, then follow the user.
```

- [ ] **Step 3: Format and verify**

Run: `npx prettier --write AGENTS.md .cursor/rules/superpowers-discipline.mdc && npm run format:check`
Expected: `All matched files use Prettier code style!`

Run: `LC_ALL=C grep -nP '[^\x00-\x7F]' AGENTS.md .cursor/rules/superpowers-discipline.mdc`
Expected: no output, exit code 1.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md .cursor/rules/superpowers-discipline.mdc
git commit -m "docs: add agent guide and superpowers workflow rule"
```

---

### Task 2: Layer 3 and gate in `testing.mdc`

**Files:**

- Modify: `.cursor/rules/testing.mdc` (the `- **Layer 3 - real Chrome end-to-end**` bullet, and a new section after "Three-layer testing strategy")

**Interfaces:**

- Consumes: gate command from Task 1.
- Produces: nothing used by later tasks.

- [ ] **Step 1: Replace the Layer 3 bullet**

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
```

- [ ] **Step 2: Add a gate section right after the Layer 3 bullet**

```markdown
## Gate

- Every commit: `npm test && npm run lint && npm run format:check`.
- Changes under `extension/src/pipeline/**`: also `npm run eval`.
- Changes to the side panel, content script, onboarding, or manifest: also a Layer 3 check.
```

- [ ] **Step 3: Format and verify**

Run: `npx prettier --write .cursor/rules/testing.mdc && npm run format:check`
Expected: `All matched files use Prettier code style!`

Run: `LC_ALL=C grep -nP '[^\x00-\x7F]' .cursor/rules/testing.mdc`
Expected: no output, exit code 1.

- [ ] **Step 4: Commit**

```bash
git add .cursor/rules/testing.mdc
git commit -m "docs: describe layer 3 browser testing and commit gate"
```

---

### Task 3: Run tests in CI

**Files:**

- Modify: `.github/workflows/ci.yml` (job `lint-and-format`)

**Interfaces:**

- Consumes: `npm test` script from `package.json`.
- Produces: nothing.

- [ ] **Step 1: Add a test step after "Install dependencies"**

Old:

```yaml
- name: Install dependencies
  run: npm ci

- name: Lint
  run: npm run lint
```

New:

```yaml
- name: Install dependencies
  run: npm ci

- name: Test
  run: npm test

- name: Lint
  run: npm run lint
```

Also rename the job display name from `Lint + format + audit` to `Test + lint + format + audit`.

- [ ] **Step 2: Verify the workflow still parses and tests pass on the CI Node version's feature set**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"`
Expected: `ok`

Run: `npm test`
Expected: `fail 0`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run unit and replay tests"
```

---

### Task 4: Final verification

- [ ] **Step 1: Clean install and full gate**

Run: `npm ci && npm test && npm run lint && npm run format:check`
Expected: `fail 0`, no lint output, `All matched files use Prettier code style!`

- [ ] **Step 2: Confirm scope**

Run: `git diff --stat main..HEAD`
Expected: only `AGENTS.md`, `.cursor/rules/superpowers-discipline.mdc`, `.cursor/rules/testing.mdc`, `.github/workflows/ci.yml`.

- [ ] **Step 3: Hand off**

Use `superpowers:finishing-a-development-branch`. Do not push or open a PR without the user's confirmation.
