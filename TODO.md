# Backlog — ideas for future versions

Loose, non-committed ideas. Move an item into a real issue/CHANGELOG entry when it's picked up.

## Toolbar-icon nudge (needs a decision)

Today `features/nudge.js` uses `declarativeContent.SetIcon` to paint a small purple
accent dot on the toolbar icon for terms/privacy-like URLs. It works, but has real
limits we hit during testing:

- **Requires the extension to be pinned.** `SetIcon` only swaps the toolbar icon, so
  if Assent lives in the puzzle-menu overflow, nothing is visible.
- **Cannot blink / animate.** Chrome does not animate toolbar icons; `declarativeContent`
  only supports a static image swap.
- **No badge without extra permissions.** `chrome.action.setBadgeText` (more eye-catching)
  can't be driven per-URL by `declarativeContent`; doing it per-URL needs `tabs` or host
  permissions, which we deliberately avoid for privacy.
- **The dot is tiny.** On a 16px icon a corner dot is ~4px and easy to miss even when pinned.

Options to evaluate next time:

1. **Bolder icon** — tint the whole icon / add a ring + larger dot. Stays permission-free,
   still requires pinning, still static.
2. **In-panel banner (preferred UX)** — when the side panel opens on a terms-like URL, show
   a prominent "This looks like a terms page — Scan it" banner. Better UX, no extra
   permission (works via `activeTab` once the panel is open).
3. **Bright badge (dot / "!")** — most visible, but requires adding the `"tabs"` permission.
4. **Drop the nudge** — scanning is manual anyway; the side-panel Scan button may be enough.

## Documentation — system requirements to run the extension

The README/onboarding should tell users, up front and in plain language, **what it takes
to actually run Assent**, so nobody installs it and hits a silent "unavailable". Gemini
Nano / the on-device Prompt API has real hardware and storage costs.

- **Disk space.** The on-device model is a multi-GB download (document the current
  Chrome figure, e.g. ~a few GB free required) and note it downloads once, lazily, on
  first use — not at install time.
- **GPU / hardware.** Give an approximate bar (VRAM / integrated-GPU note) rather than a
  hard spec. Anecdote to reconcile: it ran fine on an Apple-silicon Mac, so the guidance
  should be "modern GPU or Apple silicon, N GB RAM" instead of a scary discrete-GPU-only
  message. Verify against the official Chrome built-in-AI hardware requirements.
- **Browser / OS.** State the minimum Chrome version (we pin `minimum_chrome_version`)
  and supported desktop OSes; call out that mobile/ChromeOS may not be supported.
- **First-run flags (if any).** If any `chrome://flags` are still needed for the target
  Chrome channel, document them; otherwise state clearly that no flags are required on
  stable.
- Surface the same requirements in the onboarding "unavailable/unsupported" states so the
  in-product copy and the README agree (single source of truth for the numbers).

## Versioning & release pipeline

Right now nothing bumps the extension version on merge to `main`, and there's no
guarantee the version in `manifest.json` matches what's published on the Chrome Web
Store. We need a real release flow.

- **Single source of truth.** Keep `manifest.json` `version` and `package.json` `version`
  in sync (currently `0.4.0`). Decide the scheme (semver-ish; CWS requires up to 4
  dot-separated integers, no pre-release suffixes).
- **Automate the bump.** Add a CI workflow (on merge to `main`, or a tagged release) that
  bumps the version, updates `CHANGELOG.md`, tags the commit, and — ideally — builds the
  zip and uploads/publishes to the Chrome Web Store via the CWS API (service-account /
  refresh-token secret).
- **Guardrails.** CI check that fails a PR if `manifest.json` and `package.json` versions
  disagree, and (later) that the version is strictly greater than the currently published
  CWS version so an upload can't be rejected for a stale version.
- **Provenance.** Attach the built `.zip` as a GitHub Release artifact so each store
  submission is reproducible from a tag.

## Full code investigation — dead code, boilerplate, hardcode, and the regex question

A focused audit pass over `extension/src` (and `tests/`) to find and remove cruft before
we harden for release. Deliverable: a short report + cleanup PR(s).

- **Dead / unused code.** Hunt for unreferenced modules, exports, and helpers left over
  from the multi-language era and the auto-scan → on-demand refactor (e.g. anything the
  UK-only MVP no longer calls). Confirm with a reference check, not just intuition.
- **Boilerplate / duplication.** Repeated message-passing scaffolding, duplicated
  capability/error handling, copy-pasted DOM rendering — factor into shared helpers.
- **Hardcoded values.** Magic numbers/strings scattered across the pipeline and UI
  (thresholds, timeouts, the `type scale`/colours flagged in the UI/UX item, English
  labels that should live in `_locales`). Centralise as named constants / config.
- **The regex / URL-matching question (explicitly asked).** Reconcile "we do **not**
  analyse users' pages" with the fact that we still ship URL/text pattern matching:
  - `features/nudge.js` — `URL_KEYWORDS` drives a `declarativeContent` icon swap, which
    means Chrome evaluates **every** visited URL against those keywords (even though it's
    permission-free and stays in the browser). Decide if the nudge is worth that framing;
    ties into the "Toolbar-icon nudge (needs a decision)" item.
  - `content.js` — `isToSPage()` / `findTosLink()` regexes only run **after** the user
    hits Scan (on-demand injection), so they don't scan browsing history — but the README
    and privacy copy should make that ordering explicit so the regexes don't read as
    background surveillance.
  - Also review the pattern matching in `pipeline/steps/extract.js`,
    `extract-jurisdiction.js`, and `rubric/strip-sensitive-tokens.js`: document why each
    exists, whether it's still needed post-refactor, and whether any of it inadvertently
    processes page content the user didn't explicitly submit.
  - Outcome: either justify each regex with a one-line rationale in code/docs, or delete
    it — and make the privacy story ("nothing runs until you press Scan") verifiable.

## Other ideas

- **Finish the type-scale sweep.** The side panel now has a design-token set
  (`--fs-*`, `--space-*`, `--sev-*`) applied across the score header, sections, flags,
  and top-points list. The debug dialog, donation card, and disclaimer still use a few
  raw px values — migrate them for full consistency.
- **Make the score summary add information.** The "Top points" duplication is resolved
  (it now only shows for >3 flags), but the one-line `score-summary` still restates the
  top flag titles. Consider surfacing something additive there (service type, credit
  count) instead of repeating titles.
