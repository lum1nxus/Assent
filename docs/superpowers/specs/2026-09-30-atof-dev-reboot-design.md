# AtoF Development Reboot - Design

Date: 2026-09-30
Status: Approved in brainstorming, pending written-spec review

## Goal

Restart development of the Assent Chrome extension under a disciplined, AI-assisted
workflow built on the Superpowers plugin, rename the project to **AtoF**, and add
automated real-browser testing on top of the existing unit and replay suites.

## Decisions

| Topic        | Decision                                                                |
| ------------ | ----------------------------------------------------------------------- |
| Project name | `AtoF` (display: "AtoF"; slug: `atof`)                                  |
| Local path   | `~/repos/atof`, cloned from the existing GitHub repo with full history  |
| Stack        | Keep vanilla JS ESM, zero build step, `node:test`, ESLint 9, Prettier 3 |
| Workflow     | Mandatory Superpowers cycle for every feature and fix                   |
| Rollout      | Staged: workspace and contract first, rename second, backlog third      |
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

Short, authoritative entry point for any agent. Contains:

1. Project one-liner and a pointer to `README.md` for the full pipeline.
2. Workflow override (section 1 above).
3. Mandatory Superpowers cycle: `brainstorming`, then a spec in
   `docs/superpowers/specs/`, then `writing-plans` with a plan in
   `docs/superpowers/plans/`, then `subagent-driven-development` (or
   `executing-plans`), then `verification-before-completion`.
   Bugs start with `systematic-debugging` instead of `brainstorming`.
4. Verification gate commands (section 3.3).
5. Pointers to the scoped rules in `.cursor/rules/`.

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
- **AI classifies, code scores.** The model only picks ids from the closed taxonomy
  and returns verbatim quotes. Score and A-F grade are deterministic code.
- **Two-stage precision.** High-recall classifier, then a per-category verifier against
  curated match / not-match examples.
- **Side panel UX.** Results stay beside the page; clicking a flag highlights the
  quote in the live DOM.
- **Zero build.** The unpacked extension loads straight from `extension/`, which keeps
  the edit-reload loop and agent reasoning simple.

Known architectural risks to revisit during backlog triage (not in this spec's scope):
very long documents exceeding the sampled budget, non-agreement pages, and
model-download UX.

### 3.3 Three-layer testing

The layer names match the existing `testing.mdc`.

1. **Layer 1 - unit (`npm test`).** Pure functions: rubric math, URL safety, quote
   normalisation, JSON sanitising, guards.
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

CI currently runs lint and format but not tests. Phase 0 adds `npm test` to CI so the
gate is enforced on every push and pull request.

## 4. Roadmap

Each phase gets its own spec, plan, and implementation cycle.

- **Phase 0 - Workspace and contract (this spec's implementation).** Clone (done), add
  `AGENTS.md`, add `superpowers-discipline.mdc`, update `testing.mdc`, add `npm test`
  to CI, run the gate on a clean checkout.
- **Phase 1 - Rename and browser harness.** Two separate specs: rename Assent to AtoF
  (manifest, `package.json`, locales, UI copy, README, rules, GitHub repo name), then
  the automated Layer 3 harness.
- **Phase 2 - Backlog triage.** Turn `TODO.md` and loose ideas into a prioritised list;
  each picked item becomes a GitHub issue.
- **Phase 3 - Feature work.** One item at a time through the full Superpowers cycle.

## Out of scope

- Any change to extension behaviour, pipeline, or UI in Phase 0.
- Migration to TypeScript or a bundler.
- Multilingual support.

## Success criteria for Phase 0

- `AGENTS.md` and `superpowers-discipline.mdc` exist and are committed.
- `testing.mdc` describes automated and interactive Layer 3 and the gate commands.
- CI runs `npm test`.
- `npm ci && npm test && npm run lint && npm run format:check` pass on `main`.
- A new agent session opened in `~/repos/atof` follows the Superpowers cycle without
  being reminded.
