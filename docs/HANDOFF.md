# Handoff — pre-release audit, privacy policy, scan-state hardening

Snapshot written so this work can be picked up on another machine without re-deriving anything.

- **Branch:** `chore/mvp-hardening` (7 commits ahead of `main`, pushed)
- **Open a PR from it here:** https://github.com/lum1nxus/Assent/pull/new/chore/mvp-hardening
- The prioritised task list itself lives in [../TODO.md](../TODO.md); this file is the narrative
  context around it.

## What's on the branch

**Feature / polish work**

- `feat(pipeline)`: graceful "nothing to analyse" for non-agreement pages. A deterministic
  `detect-agreement` step runs before the model, so pressing Scan on an article or dashboard gives a
  calm "this isn't a terms page" card instead of hallucinated flags, at no inference cost.
- `fix(ui)`: score, grade badge and risk labels are colour-consistent. Grade letter, risk label and
  ring colour now all derive from one `shared/risk-bands.js` table instead of three sets of
  thresholds. Decision taken: **grade B (9-22) is green / "Low risk"**.
- Severity vs. risk-scale colour collision: minor flags used the same orange the score scale uses
  for "High risk". Minor is now a muted amber outline; major stays solid red.
- UI/UX polish pass, and pipeline progress narration (stage names instead of a bare spinner).

**Audit + policy work**

- `docs`: adds `PRIVACY.md` and the prioritised fix plan in `TODO.md`.
- `fix(scan)`: the side panel no longer spins forever when model capability regresses mid-request.

## Audit results

Three review passes were run; every Blocker/High finding was re-verified by hand against the
source, and findings that could not be reproduced were dropped. The consolidated plan with
`file:line` references is in **`TODO.md` → "Pre-release fix plan (August 2026 audit)"**.

**Verdict:** the analysis layer is genuinely well-built. The weakness is concentrated in
orchestration (`background.js`, `sidepanel.js`), which is written as if the service worker never
dies and the active tab never changes.

**Explicitly cleared** — recorded so it isn't re-litigated: no `eval` / `new Function` / dynamic
`import()` / remote code; `executeScript` only ever called with `files`; CSP stricter than the MV3
default; no analytics, telemetry, identifiers or first-party endpoint; `storage.session` left at
`TRUSTED_CONTEXTS` so content scripts can't read results; all MV3 listeners registered
synchronously at top level; and **no exploitable XSS**, despite model- and page-derived strings
flowing into `innerHTML`.

**The P0 list** (detail in `TODO.md`):

1. A stale `loading` entry permanently deadlocks a tab — Scan becomes a silent no-op under a
   spinner with no timeout. Partially fixed; see below.
2. A scan is never invalidated on navigation, so a result can be written onto a different page. The
   `abortSignal` plumbing already exists in `pipeline/index.js` and is dead — `background.js` never
   passes a signal.
3. A result can be attributed to the wrong company: `content.js` returns a cross-origin `tosUrl`
   alongside `domain: location.hostname`.
4. Invisible page text is fed to the model — `extractPageText` strips `hidden` / `aria-hidden` and
   reads `textContent`, so a publisher can farm score credits or plant suppression instructions in
   text nobody can see.
5. The diagnostic gate must land before the policy is published (below).
6. `minimum_chrome_version: "148"` locks out supported users; the extension Prompt API is stable
   from 138.
7. CI never runs `npm test`.

## Privacy policy — decisions already made

`PRIVACY.md` is the document the Chrome Web Store listing should point at:
`https://github.com/lum1nxus/Assent/blob/main/PRIVACY.md`. A posted policy is mandatory even though
all processing is local, because scraping content from a visited page counts as handling user data
regardless of where it is processed.

Locked in: contact is **GitHub Issues only**; the policy is **a file in the repo**, not GitHub
Pages; the raw document text stays but **behind an explicit debug toggle**.

**Blocking caveat.** `PRIVACY.md` §4 states the raw document text is retained only in diagnostic
mode. That is not true yet — `analyze.js` always puts `documentText` into `_debug`, and `persist.js`
spreads `_debug` into what it writes to `chrome.storage.session`. **Do not publish the policy until
that gate exists.** A policy that overstates the protection is worse than one that admits the
storage.

Separately, `README.md` used to advertise that the linked-document fetch "resolves each redirect
manually" and rejected unexpected content types. Neither was true: `redirect: "manual"` returns an
opaque response whose `Location` header cannot be read (so the `MAX_REDIRECTS` loop is dead code and
every redirect surfaces as "HTTP 0"), and the content-type guard is skipped entirely when a server
sends no `Content-Type`. The README now documents reality; both defects are tracked.

## Where to pick up

P0 items are ordered in `TODO.md`, which also carries the approved-but-unimplemented design for the
rest of **P0-1** — including why an orphaned `loading` entry can be overwritten without a staleness
threshold (`inFlight.add()` runs before the storage write, so a concurrent duplicate is already
caught upstream; reaching the storage check with status `loading` means the worker was killed).

Done here: the capability-regression route. The background used to _remove_ the tab's session state
and open onboarding; removal fires no `newValue` handler in the panel, so it kept showing the
spinner it had drawn locally. It now writes `setup_needed` and the panel renders its existing
"Open setup" card.

## Verification status

- `node --test` over `tests/*.test.js`: **187/187 pass**.
- ESLint on `extension/src` and `tests`: clean.
- Prettier: clean on every touched file.
- **Not manually tested in-browser:** the `setup_needed` path — reproducing it requires capability
  to regress between the panel's check and the background's.

Note ESLint does not actually cover the `extension/*.js` root entrypoints, so `onboarding.js` is
unlinted and two genuinely empty `catch {}` blocks are hidden there. Tracked in the plan.

## Environment notes

See "Local environment gotchas" in `TODO.md`. In short: `core.autocrlf=true` produces permanent
zero-diff "modified" files in `git status`; Prettier re-aligns markdown tables, so don't hand-align
them; and if `npm` is missing but `node` is present, run `node --test` over `tests/*.test.js` and
invoke `eslint` / `prettier` straight out of `node_modules`.
