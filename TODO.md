# Backlog — ideas for future versions

Loose, non-committed ideas. Move an item into a real issue/CHANGELOG entry when it's picked up.

---

# Pre-release fix plan (August 2026 audit)

Consolidated from three review passes — Chrome Web Store policy/privacy, MV3 code quality and
security, and tests/cruft. Every item below was re-verified against the source by hand; findings
that could not be reproduced were dropped. Ordered by risk, cheapest first within a tier.

## P0 — must land before the first store submission

1. **Stale `loading` entry permanently deadlocks a tab.** `background.js:264-266` returns silently
   when the stored status is already `loading`, and only navigation or closing the tab ever clears
   it. `startScan` (`sidepanel.js:531`) renders its spinner locally and never arms the stuck-loading
   timer, which is only armed from `dispatchState`. Net effect: if the worker dies mid-scan, or any
   path returns without writing state, **Scan becomes a permanent no-op under a spinner that never
   resolves**. Fix: treat a `loading` entry older than N seconds as stale and overwrite it, and arm
   the timeout from `startScan` rather than only on a storage event.
2. **A scan is never invalidated when the tab navigates, so results land on the wrong page.**
   `pipeline/index.js:5` already checks `ctx.abortSignal?.aborted`, and `buildContext` accepts a
   signal — but `background.js:294` calls `buildContext({ tabId, onProgress })` without one, so the
   plumbing is dead. `onUpdated` clears the stored state while the pipeline keeps running, and
   `persist.js:58` then writes the finished result back to the same `tab_<id>` key. Scan a terms
   page, navigate away, and half a minute later the panel presents site A's grade F as the analysis
   of whatever is now open. Fix: an `AbortController` per tab, aborted from `onUpdated`/`onRemoved`
   and passed into `LanguageModel.create`/`prompt`, plus a URL re-check in `persist` before writing.
3. **A result can be attributed to the wrong company.** `content.js:167-173` returns a possibly
   cross-origin `tosUrl` alongside `domain: location.hostname`, so a blog that merely links to
   another company's terms gets that company's grade shown against the blog's own domain. For a
   product whose entire output is a public judgement about a named business this is the highest-
   consequence bug in the codebase. Restricting the linked-document fetch to same-origin fixes this,
   the DNS-rebinding gap, and the CORS failure below in one change.
4. **Invisible page text is fed to the model.** `extractPageText` (`content.js:53-58`) actively
   strips `hidden` and `aria-hidden="true"` and then reads `textContent`, which also includes
   `display:none` and off-screen text. A publisher can bury consumer-friendly clauses in an
   invisible block to farm score credits, or plant instructions aimed at the model to suppress
   flags. Quote verification is no defence — the text really is in the document. Note the fix is not
   a one-liner: the extraction runs on a **detached clone**, where `getComputedStyle` reports
   nothing, so visibility has to be resolved against the live DOM (or via `innerText` semantics)
   before cloning. Keep genuinely collapsed accordion content, which is why the stripping exists.
5. **Publish nothing until the diagnostic gate matches the policy** — see the privacy-policy
   section below. `PRIVACY.md` §4 promises the raw document text is retained only in diagnostic
   mode; today `persist.js` stores it after every scan.
6. **`minimum_chrome_version: "148"` locks out supported users.** The extension Prompt API is stable
   from Chrome 138; 148 is the web-exposed number. One line in `manifest.json`.
7. **Done - CI runs the tests.** `npm test` runs in CI on Node 24 (version from `.nvmrc`). The
   locale-parity job is kept: it costs nothing and matters as soon as a second locale lands.

### P0-1: what is already done, and the approved design for the rest

The capability-regression route is fixed (the background writes `setup_needed`, the panel renders
its existing "Open setup" card). It has not been tested in a real browser yet: reproducing it
requires the model capability to regress between the panel's check and the background's. The rest
of P0-1 was designed and reviewed but not yet written:

- **Overwrite an orphaned `loading` entry** in `handleTosDetected` instead of returning. This is
  safe without a timestamp or a staleness threshold, and the reasoning matters: `inFlight.add()`
  happens _before_ the storage write, so a genuine concurrent duplicate is already caught by the
  `inFlight` guard above. Reaching the storage check with status `loading` therefore means this
  worker has no scan running — and only the worker can run one. The entry is always orphaned (the
  worker was killed), so respecting it is what wedges the tab forever.
- **`failScan` when `sanitizeUrl` returns null** (the `!tosUrl` branch) instead of returning
  silently; `unsupported_page` is the right code.
- **Arm the stuck-loading timer from `startScan`**, not only from `dispatchState`. The latter needs
  a storage write to have happened, which is exactly what is missing on every silent path.
- **Add a short "did the scan actually start?" check** (~10 s) next to the existing 5-minute
  timeout. The background writes `loading` within milliseconds of starting, so a tab still `idle`
  10 s after the request never started at all — and 5 minutes is a punishing wait for that case.
  Needs one new locale string, and a retry button in `renderError` for the new code is the useful
  affordance.
- Not strictly P0-1 but the same family: `SCAN_ACTIVE_TAB` / `HIGHLIGHT_IN_TAB` should carry the
  panel's `currentTabId` the way `GET_STATE` already does, and `loadStateForActiveTab` needs a
  `try`/`catch` — a rejected `GET_STATE` currently leaves the panel blank with no retry.

## P1 — high

- **The verifier fails open and then shows its own failure as the reasoning.** `verify.js:138-141`
  creates its session with only `{temperature, topK}`, omitting the `LM_OPTIONS` that
  `capability.js` validated and `analyze.js` passes — so a systematic failure is plausible, not
  theoretical. Five paths then return `match: true`, and `verifierReason` is rendered verbatim at
  `sidepanel.js:93`, so users read `verifier error (kept by default): …` as if it were the
  explanation of a flagged clause. Create the session with `LM_OPTIONS`; when `verifierFailed`,
  suppress the reason and mark the flag unverified.
- **Input budgeting under-measures the prompt.** `fitToInputBudget` (`analyze.js:277-307`) measures
  only the document text and leaves a 128-token margin, but Chrome documents that the
  `responseConstraint` schema is included in the message and consumes the context window —
  and `ANALYZE_SCHEMA` is large. Long documents overflow and surface as a scan failure. Measure with
  the constraint or set `omitResponseConstraintInput: true`; also migrate off the deprecated
  `inputQuota`/`measureInputUsage` names to `contextWindow`/`measureContextUsage`.
- **`buildNormalisedTextMap` allocates one object and runs ~4 regexes per character.**
  `content.js:364-411`. On a large terms page "Show in document" freezes the tab for seconds.
  Normalise once per text node and binary-search node offsets at lookup.
- **"Show in document" can never work for fetched documents, and fails silently when it doesn't.**
  When the analysis came from `fetchTosText`, the quotes belong to a different page than the tab.
  The failure is swallowed at `background.js:48`, so the button does nothing with no feedback. Hide
  the button when the document was fetched elsewhere, and report a real failure otherwise.
- **Empty overlay pill on unsupported-language scans.** `background.js:310` sends
  `{ kind: "unsupported" }`, but `showOverlay` (`content.js:604-637`) only branches on `loading`,
  `done`, and `error` — and `ensureOverlay()` has already inserted `<div class="pill" id="root">`,
  which is styled with padding and a dark background. The user is left with a small blank dark
  lozenge stuck in the corner, with no text and no dismiss button, until they navigate.
- **Scan and highlight target the wrong window.** `background.js:154` and `:241` use
  `{ active: true, currentWindow: true }` from the service worker, where that means the last-focused
  window, while the side panel already knows its own tab. With two windows open, pressing Scan in
  the unfocused window scans the other window's tab and leaves the panel spinning. Send the
  panel's `currentTabId` explicitly, as `GET_STATE` already does.
- **A blank side panel with no recovery.** `loadStateForActiveTab` (`sidepanel.js:698`) has no
  `try`/`catch`, and the `GET_STATE` handler (`background.js:57-60`) has no `.catch`. On an
  extension update or a worker-startup race the message rejects, nothing renders, and `<main
id="app">` stays empty. Add both, plus a retry affordance.
- **Internal diagnostics are the user-facing error text.** `pipeline/index.js:17` produces
  `step "verify" failed: …` and `background.js:332` stores `err.message` straight into the state
  the panel renders. Keep the wrapped string for logs and the debug bundle; display a mapped,
  localised message.
- **Two divergent Unicode normalisers.** `content.js:255-261` and `analyze.js:309-317` handle
  different character sets, and the guillemet mapping in `content.js` is dead code (listed twice, so
  the second replace never fires). A quote that passes `quoteAppearsInDocument` can therefore fail
  to highlight. Extract `shared/normalize-text.js` — this is the duplication with real consequences.
- **The quote floor is below the schema's own minimum.** `analyze.js:320` accepts 12 characters
  where `ANALYZE_SCHEMA` declares `minLength: 20`, so a bare section heading — present verbatim in
  any agreement — clears verification and contributes a full-weight penalty. Raise to the schema
  minimum and require a minimum word count.
- **Jurisdiction misclassification.** `extract-jurisdiction.js` matches by substring, so a UK
  document mentioning Northern Ireland is classified as EU. Match on word boundaries.
- **Done - ESLint covers every JS file.** `npm run lint` now lints `extension`, `tests`, and
  `scripts`. The empty `catch {}` blocks in `onboarding.js` pass because the config allows empty
  catches; whether they should log is a separate style decision.
- **The result cache outlives its document.** `sidepanel.js:674-685` keys by tab id and compares
  only origin + pathname, and replays on `idle`. Reloading a page clears the badge but the panel
  still shows the old grade, and `?doc=terms` → `?doc=privacy` shows the wrong document's analysis.

## P2 — worth doing, not release-blocking

- **`DUMP_STATE` returns every tab's state, including full `documentText`** (`background.js:70-73`).
  Only reachable from an extension context, so not remotely exploitable, but it is a shipped
  aggregation point for all scanned text. Gate behind a build flag or delete it.
- **`isTrustedSender` passes when `sender.id` is absent**, in both `background.js:679`-style copies.
  Unreachable today because there is no `externally_connectable` — and silently permissive in two
  files the day someone adds one. Invert the check and move it to `shared/`.
- **Overlay shadow root is `mode: "open"`** (`content.js:514`), so a hostile page can rewrite the
  pill — turning an F into an A on its own terms page — or hide it with `!important`. Use `closed`
  with a module-scoped reference and treat the side panel as the authoritative surface.
- **Badge colours bypass the single source of truth.** `background.js:459-469` keeps its own palette
  and thresholds, so a grade D is amber on the badge and orange in the panel. Derive from
  `bandForScore`.
- **Session key built three ways** (`background.js:22`, `persist.js:5`, `sidepanel.js:775`), and
  `persist.js` already exports the constant nobody imports. A schema change would break reads
  silently.
- **Three HTML escapers with three different escape sets**, and `escAttr` exists in only one of
  them. No exploitable XSS today — every interpolation was checked — but the next attribute-context
  interpolation is where it bites. Consolidate into `shared/escape-html.js`.
- **No schema version on any stored object**, so a shape change mis-renders session results that
  survive an extension update.
- **Dead code:** `onboarding_completed` is written and never read; `SEVERITY_RANK.low`
  (`top-three.js:1`) is not a valid severity; the no-references verifier branch is currently
  unreachable — add a test asserting key parity between `CATEGORIES` and `CATEGORY_REFERENCES` so it
  stays that way.
- **Onboarding progress bar never animates**, because `onboarding.js:99-106` rebuilds the card's
  `innerHTML` on every progress event. Render once, then update `style.width`.
- **Keep-alive margin is 5 s.** `background.js:343-349` pings every 25 s against a 30 s idle
  timeout. Drop to 20 s now; the real answer for long inference is an offscreen document or
  per-step checkpointing so a restarted worker can resume.
- **`background.js` is 475 lines** of routing, orchestration, HTTP with SSRF logic, HTML stripping
  and badge rendering — the only non-cohesive module in an otherwise tidy codebase. Split it.
- **Undocumented pipeline payload.** Each step spreads `...input` and adds fields with no typedef,
  so understanding what `verify` may rely on means reading four upstream files. One JSDoc
  `@typedef` in `pipeline/index.js` pays for itself.
- **Severity naming hides a weighting difference.** `severityClass` collapses `full` into "Major"
  while the scorer weights `full` at 1.0 and `high` at 1.5, so two identical-looking Major flags can
  differ by 50 % in penalty.

## What the audit explicitly cleared

Worth recording so it is not re-litigated: no `eval`, `new Function`, dynamic `import()`, or remote
code; `executeScript` is only ever called with `files`; the CSP is stricter than the MV3 default; no
analytics, telemetry, identifiers, or first-party endpoint of any kind; `storage.session` is left at
`TRUSTED_CONTEXTS` so content scripts cannot read results; all MV3 listeners are registered
synchronously at top level; and **no exploitable XSS** was found despite model- and page-derived
strings flowing into `innerHTML` — escaping is applied in every element context, `escAttr` guards
the one attribute context carrying model data, and grade letters are allow-listed before being
spliced into a class name. The `sanitize-json.js` recovery path, the closed category taxonomy, and
the deterministic scorer were all judged above the bar for a first release.

---

## Store submission — outstanding items for the privacy policy

[PRIVACY.md](PRIVACY.md) is written and is the document we point the Chrome Web Store at
(`https://github.com/lum1nxus/Assent/blob/main/PRIVACY.md`). Two things still have to happen
before it is truthful and complete:

- **Gate the diagnostic payload behind an explicit debug toggle — required before publishing.**
  `PRIVACY.md` §4 states that the raw document text and the raw model response are retained
  "only when you have explicitly turned on diagnostic mode". Today that is not true: `analyze.js`
  always puts `documentText` into `_debug`, and `persist.js` spreads `_debug` straight into the
  object it writes to `chrome.storage.session`. So the full extracted document sits in session
  storage after every scan whether or not anyone opens the debug view. Either gate the capture on
  a stored debug flag or strip `documentText` in `persist` unless that flag is set. **The policy
  must not go live while the code contradicts it** — a privacy policy that overstates the
  protection is worse than one that admits the storage.
- **Dashboard work (no code).** Paste the policy URL into the CWS listing, complete the data-use
  disclosure checkboxes, and tick the Limited Use certification. Note that the single honest
  disclosure to make is "Website content", used only for the user-facing feature and not
  transferred — everything else in the taxonomy is a genuine "no".

## Harden the linked-document fetch (`fetchTosText`)

Two verified defects in `background.js:372-414`, both found during the audit and both now described
honestly in the README rather than papered over:

- **Redirects are never followed.** The request sets `redirect: "manual"` and then inspects
  `res.status` and the `Location` header, but an opaque-redirect response reports `status: 0` with no
  readable headers. So the `res.status >= 300` branch is unreachable, the `MAX_REDIRECTS` loop is dead
  code, and every redirect — `http → https`, `/terms → /legal/terms`, even a trailing slash — surfaces
  to the user as "HTTP 0". Fix: use `redirect: "follow"` and re-validate the final `res.url` through
  `sanitizeUrl`, which is also the only way to keep the SSRF guard meaningful across hops.
- **A missing `Content-Type` bypasses the type check.** `if (contentType && !ALLOWED_CONTENT_TYPES...)`
  skips validation entirely when the header is absent, so a server that declares nothing gets through.
  Fix: treat an undeclared type as a rejection (or sniff, then reject).

Related and higher-priority: restricting the linked-document fetch to same-origin would remove the
cross-origin case altogether, which simultaneously fixes the wrong-domain attribution bug, the DNS
rebinding gap in `url-safety.js`, and the CORS failure that makes cross-origin fetches fail anyway.

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

## Onboarding — explain what the one-time download actually does

On the first-run **download** screen (`onboarding.js` → `renderDownloadable()`, the
`onbDownloadableTitle` / `onbDownloadableBody` / `onbDownloadBtn` block), add a short,
plain-language explainer **above the button** so the user knows exactly what pressing
it does and never feels like something opaque is happening. Keep it to a few tight
bullets, e.g.:

- **Downloading Google's public on-device AI model to your device** — this is a
  one-time, multi-GB download that happens now, not at install time.
- **Everything runs locally.** Your browsing and the documents you scan never leave
  your device; there is no Assent server.
- **This can take a few minutes** depending on your connection; you only do it once.
- (Optional) **Free disk space needed:** ~N GB — mention the current figure.

Be precise about the Google relationship (don't over- or under-claim):

- We do **not** grant Google any API permission, and there is **no Google account, API
  key, or OAuth** involved. For Chrome Extensions the Prompt API ships in Chrome stable
  (since Chrome 138) with no origin-trial token — we just call a browser JS API
  (`LanguageModel`), the same category as any Web API.
- The **only** contact with Google is the one-time **model download** (Gemini Nano) via
  Chrome's component updater — that's a network request to Google's servers for the model
  itself, not for user data.
- **Inference is fully local**: prompts and scanned documents never leave the device and
  are never sent to Google or to us.
- So frame it as _"one-time download of Google's public model, then everything runs
  locally"_ — avoid both "we send data to Google" (false) and "nothing ever touches
  Google" (the download itself does).

Notes:

- Put the copy in `_locales` (new keys), not hard-coded, so it stays localisable.
- Reuse the same wording family as the privacy note in the README/side panel so the
  "local, private, one-time" message is consistent everywhere.
- Keep it scannable: bullets/icons over a paragraph; the button stays the clear CTA.

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

**Done — the findings now live in the Pre-release fix plan above.** The regex question is answered
in the last bullet of this section and in [PRIVACY.md](PRIVACY.md) §3.1-3.2; the dead-code and
duplication findings are in P2. Kept here for the original reasoning.

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

## Local environment gotchas (worth knowing on a fresh machine)

- **`core.autocrlf=true`** in at least one clone, which makes `git status` permanently report
  several `extension/` and `tests/` files as modified with a **zero-content diff**. That is
  line-ending noise, not someone's unfinished work — confirm with
  `git diff --ignore-all-space --stat` before assuming there are pending changes to preserve.
- **Prettier formats markdown too**, and it re-aligns markdown tables to equal column widths.
  Hand-written tables therefore fail `format:check` unless they happen to match byte for byte;
  `PRIVACY.md` uses lists instead for that reason. Run the formatter, don't hand-align.
- If `npm` is missing but `node` is present, the checks still run directly:
  `node --test` over `tests/*.test.js`, `node node_modules/eslint/bin/eslint.js extension/src tests`,
  and `node node_modules/prettier/bin/prettier.cjs --check .`

## Other ideas

- **Finish the type-scale sweep.** The side panel now has a design-token set
  (`--fs-*`, `--space-*`, `--sev-*`) applied across the score header, sections, flags,
  and top-points list. The debug dialog, donation card, and disclaimer still use a few
  raw px values — migrate them for full consistency.
- **Make the score summary add information.** The "Top points" duplication is resolved
  (it now only shows for >3 flags), but the one-line `score-summary` still restates the
  top flag titles. Consider surfacing something additive there (service type, credit
  count) instead of repeating titles.
