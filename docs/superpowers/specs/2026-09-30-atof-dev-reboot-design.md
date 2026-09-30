# AtoF Development Reboot - Design

Date: 2026-09-30
Status: Approved in brainstorming, pending written-spec review

## Goal

Restart development of the Assent Chrome extension under a disciplined, AI-assisted
workflow built on the Superpowers plugin, fully reconfigure the development environment,
rename the project to **AtoF**, and then work through the existing pre-release audit.

## Starting point

- `main` is behind. The latest work is on `chore/mvp-hardening` (8 commits, linear on top
  of `main`, 187 tests passing): non-agreement page detection, risk-band colour
  consistency, scan narration, `PRIVACY.md`, part of P0-1, and the August 2026 pre-release
  audit in `TODO.md` with a P0 / P1 / P2 list.
- `chore/mvp-hardening` is merged into `main` through a pull request before or alongside
  Phase 0. Phase 0 work is branched from `chore/mvp-hardening` so it does not wait on that
  merge.

## Decisions

| Topic        | Decision                                                                |
| ------------ | ----------------------------------------------------------------------- |
| Project name | `AtoF` (display: "AtoF"; slug: `atof`)                                  |
| Local path   | `~/repos/atof`, cloned from the existing GitHub repo with full history  |
| Stack        | Keep vanilla JS ESM, zero build step, `node:test`, ESLint 9, Prettier 3 |
| Node         | Node 24 LTS in CI and as the documented local version (Node 20 is EOL)  |
| Workflow     | Mandatory Superpowers cycle for every feature and fix                   |
| Rollout      | Environment first, rename second, then the audit list                   |
| Backlog      | `TODO.md` audit list is the backlog; its order is reviewed, not redone  |
| Repo rename  | GitHub repo rename happens in Phase 1, not Phase 0                      |

## 1. Workspace and rule isolation

- The repo lives in `~/repos/atof`, outside the day-job work tree.
- Day-job user rules (ticket-id branch names, base-branch prompts, infrastructure maps)
  do not apply here. A root `AGENTS.md` states this override explicitly.
- Branches: `<type>/<short-change>` without ticket ids. Commits and PR titles use
  Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Base branch is always `main`.

## 2. Operating contract (Cursor + Superpowers)

### `AGENTS.md` (repo root)

The single entry point for any agent. Contains:

1. Project one-liner and pointers: `README.md` for the pipeline, `TODO.md` for the
   prioritised backlog, `TESTING.md` for manual browser testing.
2. Workflow override (section 1 above).
3. Mandatory Superpowers cycle: `brainstorming`, then a spec in
   `docs/superpowers/specs/`, then `writing-plans` with a plan in
   `docs/superpowers/plans/`, then `subagent-driven-development` (or
   `executing-plans`), then `verification-before-completion`.
   Bugs start with `systematic-debugging` instead of `brainstorming`.
4. Verification gate commands (section 3.3).
5. Pointers to the scoped rules in `.cursor/rules/`.

`docs/HANDOFF.md` was a one-off snapshot for moving between machines. Its content already
lives in `TODO.md` except one note (the `setup_needed` path is not yet tested in a real
browser), which moves into the P0-1 section of `TODO.md`. `docs/HANDOFF.md` is then
deleted so there is one entry point.

### `.cursor/rules/`

Existing rules are kept as they are, apart from `testing.mdc`:

- `chrome-extension.mdc` - MV3 permissions, CSP, messaging, accessibility.
- `pipeline-and-rubric.mdc` - closed taxonomy, deterministic scoring, classifier-verifier.
- `testing.mdc` - Layer 3 gains the automated and interactive browser testing described below, plus the gate commands.
- `code-style.mdc` - no comments, ASCII punctuation, ESM only.
- `legal-posture.mdc` - unchanged.

New rule:

- `superpowers-discipline.mdc` (`alwaysApply: true`) - no implementation without an
  approved spec and plan; no completion claim without running the gate commands.

`AGENTS.md` is the single place that describes the workflow; rules hold only scoped
technical constraints, so they do not duplicate each other.

## 3. Architecture fit and testing

### 3.1 Job to be done

Users accept long agreement documents without reading them. AtoF surfaces the
clauses that matter, each backed by a verbatim quote the user can check in the page.

### 3.2 Why the current architecture fits

- **On-device only.** The built-in on-device model through the Chrome Prompt API: no
  servers, no keys, no telemetry, no cost. Agreement text never leaves the machine.
- **Small context window.** The model's input budget is limited, so the extractor does
  keyword-weighted, zone-sampled extraction before the model sees anything.
- **Cheap gate before the model.** The deterministic `detect-agreement` step rejects
  non-agreement pages before any inference.
- **AI classifies, code scores.** The model only picks ids from the closed taxonomy
  and returns verbatim quotes. Score, A-F grade, and risk band are deterministic code.
- **Two-stage precision.** High-recall classifier, then a per-category verifier against
  curated match / not-match examples.
- **Side panel UX.** Results stay beside the page; clicking a flag highlights the
  quote in the live DOM.
- **Zero build.** The unpacked extension loads straight from `extension/`, which keeps
  the edit-reload loop and agent reasoning simple.

The audit's verdict matches: the analysis layer is solid, the weak spot is orchestration
in `background.js` and `sidepanel.js` (service-worker death, tab navigation). That is
what the P0 list fixes; no architectural rewrite is planned.

### 3.3 Three-layer testing

The layer names match the existing `testing.mdc`.

1. **Layer 1 - unit (`npm test`).** Pure functions: rubric math, risk bands, agreement
   detection, URL safety, quote normalisation, JSON sanitising, guards.
2. **Layer 2 - AI-output replay (`npm test`, `npm run eval`).** Captured model outputs
   in `tests/fixtures/ai-outputs/` replayed through the pipeline in pure Node, without
   Chrome. Every pipeline change runs `npm run eval`.
3. **Layer 3 - real Chrome.**
   - Automated (built in Phase 1): a script launches Chrome for Testing with the
     unpacked extension, opens a fixture agreement page, drives the side panel
     "Scan this page" flow over the Chrome DevTools Protocol, and asserts on the
     side-panel output, session storage, service-worker console errors, and quote
     highlighting in the page.
   - Interactive (available now): during development the agent uses the
     `chrome-devtools` MCP to inspect the live extension (console, network, DOM,
     screenshots).
   - Tooling choice and how the on-device model is handled in automated runs are
     decided in the Phase 1 harness spec.

Gate before any commit: `npm test && npm run lint && npm run format:check`.
Pipeline changes additionally require `npm run eval`. UI changes additionally require
a Layer 3 check, interactive until the automated harness exists.

### 3.4 Tooling fixes in Phase 0

- **CI runs tests** (audit P0-7). Add `npm test` to CI.
- **Node 24.** CI moves from Node 20 to Node 24. Add `.nvmrc` with `24` and
  `"engines": { "node": ">=24" }` in `package.json`.
- **Lint covers everything** (audit P1 item "ESLint does not cover the root entrypoints").
  Browser config applies to `extension/**/*.js`, Node config to `tests/**/*.js` and
  `scripts/**/*.mjs`, and `npm run lint` lints `extension tests scripts`. A probe run with
  this scope reports zero errors, so no source changes are needed.

## 4. Roadmap

Each phase gets its own spec, plan, and implementation cycle.

- **Phase 0 - Environment and contract (this spec's implementation).** `AGENTS.md`,
  `superpowers-discipline.mdc`, `testing.mdc`, retire `docs/HANDOFF.md`, the tooling fixes
  in 3.4, and mark P0-7 and the ESLint item done in `TODO.md`.
- **Phase 1 - Rename and browser harness.** Two separate specs: rename Assent to AtoF
  (manifest, `package.json`, locales, UI copy, README, `PRIVACY.md` and its store URL,
  rules, GitHub repo name), then the automated Layer 3 harness.
- **Phase 2 - Audit P0 list.** Start with a short review of the P0 / P1 / P2 order in
  `TODO.md` with the user, then take the P0 items one at a time. P0-1 already has an
  approved design in `TODO.md` and goes straight to `writing-plans`.
- **Phase 3 - P1, P2, and new features.** One item at a time through the full cycle.

## Out of scope

- Any change to extension behaviour, pipeline, or UI in Phase 0.
- Migration to TypeScript or a bundler.
- Multilingual support.

## Success criteria for Phase 0

- `AGENTS.md` and `superpowers-discipline.mdc` exist; `docs/HANDOFF.md` is gone.
- `testing.mdc` describes automated and interactive Layer 3 and the gate commands.
- CI runs `npm test` on Node 24; `.nvmrc` and `engines` pin Node 24.
- `npm run lint` covers `extension`, `tests`, and `scripts` and passes.
- `npm ci && npm test && npm run lint && npm run format:check` pass.
- A new agent session opened in `~/repos/atof` follows the Superpowers cycle without
  being reminded.
