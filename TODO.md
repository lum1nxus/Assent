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

## Scan progress narration (UX)

During a scan the side panel should say **what it's doing**, step by step, so the user
isn't staring at a blank spinner — especially when a scan is slow.

- Surface each pipeline stage in plain language as it runs (e.g. "Reading the document",
  "Detecting language", "Classifying clauses", "Verifying findings", "Finalising").
  The plumbing partly exists (`ctx.onProgress(step.name)` in the runner →
  `stage` in session storage → `PIPELINE_STAGE_LABELS` in `sidepanel.js`), but it needs
  to be reliable and localised, and the labels should be friendlier.
- Show **model-download progress** as a first-class state. Attach a `monitor` to
  `LanguageModel.create()` (and `LanguageDetector.create()`) and stream
  `downloadprogress` into the loading UI as "Downloading model N%". Today a first-run
  download inside the AI call looks like an infinite spinner (see the 5-minute-hang
  report during testing).
- Consider a lightweight elapsed-time hint or reassurance copy for long scans
  ("This can take a moment the first time…"), and keep the existing stuck-loading
  timeout as a backstop.
- Include the live stage in the Debug bundle even while status is `loading`, so a hang
  can be diagnosed from the debug export rather than only the service-worker console.

## Non-agreement page → graceful "nothing to analyze"

If the user presses **Scan this page** on a page that is _not_ a terms / EULA /
privacy / agreement document (e.g. a random article, a dashboard, a search result),
we must **not** feed arbitrary page text to the model and risk hallucinated flags or a
misleading grade. Instead: recognise "this isn't an agreement page" and show a calm,
explicit message like _"This doesn't look like a terms or agreement page — open a
Terms of Service, EULA, or privacy policy and scan again."_

Notes / direction:

- Prefer a **deterministic pre-filter** (no model cost, no false accusations):
  reuse/extend `content.js` `isToSPage()` + `findTosLink()` plus a legal-keyword
  density check in `extract`. If the page has no agreement signals and no ToS link,
  short-circuit before `analyze` and return a dedicated "not an agreement" result.
- Keep this **distinct** from the existing states: it is not `errorNoDocument`
  (empty/blocked extraction) and not `lowRecall` (model ran but nothing survived
  quote-verification). Add a first-class `notAgreement` pipeline outcome + side-panel
  state with friendly copy.
- Optional stronger gate: a single cheap yes/no model classification ("is this a
  consumer agreement document?") before the full analyze — but only if the
  deterministic filter proves insufficient, since it adds latency and a model call.
- Make sure an accidental scan is cheap and reassuring, never alarming.

## UI/UX polish pass

A dedicated pass over the side panel (`extension/src/sidepanel/index.html` CSS +
`sidepanel.js` rendering). Goal: one consistent visual language, less redundancy.
No behavioural changes.

### Reported

1. **Copy casing.** `footerAttribution` = "Open source · independent · not affiliated
   with any third party" — "Open source" is capitalised while the rest is lower-case.
   Make it consistent ("open source · independent · …") and audit all UI strings for
   sentence-case consistency.
2. **Loading redundancy.** `renderLoading` shows the generic "Scanning document…"
   _and_ the live stage ("Classifying clauses"). Drop the generic line and show a
   single evolving status. (Ties into the "Scan progress narration" item above.)
3. **Score header looks cramped.** The grade badge / risk label / sublabel / summary
   in `.score-meta` lack vertical rhythm — align and space them. The `ⓘ` glyph is a
   CSS `::before { content: "i" }` hack on `.score-sublabel` (index.html ~L203) —
   drop it or make it a real icon with a tooltip.
4. **Drop the "Why this was flagged" label.** The literal `labelWhyFlagged` prefix
   printed above each clause (`renderFlag` → `.flag-verifier-note`) looks clumsy.
   Remove the label text; either show the verifier reason on its own (phrased so it
   reads naturally without a prefix) or drop the line entirely. Reassess whether the
   reason adds value next to the verbatim quote at all.
5. **Colour mismatch** between "Top points to know" and "Flagged clauses":
   - `.top3` border-left: high=red, **full=orange**, partial=yellow.
   - `.flag-dot`: high/**full=red**, partial=orange.
     So "full" is orange in one place and red in the other; "partial" is yellow vs
     orange. Unify the severity→colour mapping across `.top3`, `.flag-dot`, and
     `.flag-severity-pill`.

### Additional findings

- **Fragmented colour system.** Two unrelated scales coexist: the 5-band score
  ring/label (green → #d9f99d → yellow → orange → red) and the 3-value severity
  (high/full/partial) with inconsistent colours. Define one semantic token set and
  reuse it everywhere.
- **Severity naming.** "full" / "partial" aren't user-friendly and collapse into only
  two colours; reconsider the severity vocabulary and its visual encoding.
- **Triple repetition of the same clauses.** `score-summary` ("Document contains: X
  and Y"), then "Top points to know", then "Flagged clauses" all list the same titles
  when there are ≤3 flags. Hide/merge "Top points" when it duplicates the flags list;
  make the summary add information rather than repeat it.
- **`.flag-body { max-height: 320px }`** clips long verifier-note + quote combos
  (overflow hidden) — content can be cut off. Use a real expand or a larger cap.
- **Loading stage labels are hard-coded English** (`PIPELINE_STAGE_LABELS` in
  `sidepanel.js`) — move to `_locales` for i18n consistency.
- **Ad-hoc type scale** (10/11/12/13/14/18px scattered) — define a small, reused scale.
- **Score colour vs wording dissonance** — a score of 11 uses a light-green tint while
  the label says "Moderate risk"; align the colour semantics with the risk wording.

Deliverable: a small design-token pass (colours, spacing, type) + targeted markup
tweaks.

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

- (add future items here)
