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
