# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Graceful "nothing to analyse" for non-agreement pages.** Scanning is user-initiated,
  so a user can press **Scan this page** on an article, dashboard, or search result. A new
  deterministic `detect-agreement` pipeline step (no model cost) runs before analysis and,
  when a page shows no legal/agreement vocabulary, short-circuits with a first-class
  `notAgreement` outcome and a calm side-panel message ("This doesn't look like a terms,
  agreement, or privacy page…") plus a **Scan again** button — instead of feeding arbitrary
  text to the model and risking hallucinated flags or a misleading grade. The gate is
  lenient (a real Terms/EULA/privacy document is saturated with this vocabulary), so it only
  rejects pages with essentially none of it. Distinct from the empty-document error and from
  a low-recall model result.
- **Optional "Allow on every page" convenience permission.** `activeTab` is dropped on
  every navigation, so by default the toolbar icon must be clicked on each new page
  before the side-panel **Scan** button can reach it. The panel now offers a one-time
  opt-in to the optional `*://*/*` host permission; once granted, **Scan this page** works
  on any page without re-clicking the icon. It is off by default and, even when granted,
  the page is still only read on an explicit Scan press. The "could not access this page"
  error now surfaces this opt-in directly as the fix.

### Changed

- **On-demand, privacy-first scanning.** The extension no longer injects a content
  script into every page or scans the DOM in the background. Analysis is now
  explicitly triggered from the side panel's **Scan this page** button. The page is
  read only on that click, via `activeTab`, using `chrome.scripting` on-demand
  injection.
- **Reduced permissions.** Removed the `http://*/*` + `https://*/*` host permissions
  and the automatic `content_scripts` registration. Permissions are now `activeTab`,
  `scripting`, `storage`, `sidePanel`, and `declarativeContent`.
- **Analyzer input budgeting.** `analyze` now requests the language model with explicit
  `expectedInputs`/`expectedOutputs` (English) and trims the document to the model's
  measured input budget (`measureInputUsage` / `inputQuota`), preventing context
  overflow from the large system prompt. Quote verification runs against the text
  actually sent to the model.

### Added

- **`minimum_chrome_version` set to 148**, so the Chrome Web Store will not offer the
  extension to browsers that lack the built-in Prompt API.
- **First-time onboarding page** (`onboarding.html` / `onboarding.js`) with a full
  capability state machine: checking, ready, downloadable, downloading,
  unavailable-hardware, and unsupported-browser, including a one-click model download
  with live progress and an advanced force-enable path.
- **Capability & download modules** (`features/capability.js`,
  `features/model-download.js`) shared by the onboarding page, side panel, and
  background scan gate.
- **Toolbar-icon nudge** (`features/nudge.js`): a best-effort accent on the action
  icon for terms/privacy-like URLs via `declarativeContent`, requiring no browsing
  history access.
- **Side-panel scan/setup routing**: the idle state now shows a **Scan this page**
  button; when the model is not ready it is replaced by **Open setup**. Highlight
  requests are routed through the background worker, which (re)injects the extractor
  as needed.
- **New tests** for capability detection, model download, and input-budget trimming.
- **Localised, live scan-progress narration.** The side-panel loading state now shows a
  single evolving stage line ("Reading the document" → "Classifying clauses" →
  "Verifying findings" → "Finalising") driven by the pipeline, instead of a static
  spinner alongside a duplicate "Scanning document…" line. Stage labels moved from a
  hard-coded map into `_locales`. The "this can take a moment the first time"
  reassurance now shows only until the first scan completes on the device (tracked in
  `chrome.storage.local`), instead of on every scan.

### Fixed

- **Severity vs. risk-scale colour collision.** Minor flags were a solid warm orange —
  the same hue the score scale uses for "High risk" — so a minor clause could be misread
  as high-risk, and it clashed with a green "Low risk" header. Minor severity is now a
  muted amber outline (calm, clearly "noted but minor") while major stays a solid red, so
  the two axes (overall document risk vs. per-clause severity) no longer fight over the
  same colours.
- **Grade colour vs. risk label mismatch.** A green grade "B" (score 9–22) was shown next
  to a yellow "Moderate risk" label because the grade letters and the ring/label colours
  were two separate hard-coded threshold tables with different cut-offs. Both now derive
  from a single `shared/risk-bands.js` table, so the grade badge, ring colour, and risk
  wording can no longer drift apart. Score 9–22 now reads as green "Low risk" to match the
  "B" grade. A regression test locks `gradeOf` and the UI bands to the same table.
- **Stale in-page pill.** The floating "grade + Open details" pill left in a page's DOM
  by a previous extension build could show an outdated badge (e.g. a malformed grade).
  The content script is now build-stamped: `ensureInjected` re-injects when the live
  script is from a different version, old pills are removed on injection, and the badge
  grade is clamped to a valid A–F letter so its text always matches its colour.

### Fixed (UI/UX polish pass)

- **Unified severity colours.** "Top points", flag dots, and severity pills now share
  one semantic mapping (major = red, minor = orange) via CSS design tokens; previously
  "partial" was yellow in the top list but orange on the dots/pills.
- **Score colour vs wording alignment.** The score ring/number colour bands now match
  the risk-label thresholds, so a "Moderate risk" score is no longer tinted green.
- **Design-token pass.** Introduced a reusable severity/type/spacing token set in the
  side-panel stylesheet and applied it across the score header, sections, flags, and
  top-points list.
- **Cleaner score header.** Removed the pseudo-`ⓘ` glyph hack and gave the grade / risk
  label / sublabel / summary consistent vertical rhythm.
- **Removed the "Why this was flagged" label**; the verifier reason now reads on its own.
- **Friendlier severity wording.** Pills show "Major"/"Minor" instead of the raw
  `high`/`full`/`partial` enum.
- **Reduced repetition.** "Top points to know" is now shown only when there are more than
  three flags (where it acts as a priority digest); otherwise it was identical to the
  full "Flagged clauses" list.
- **Longer flag bodies no longer clip.** Raised the collapsed-panel `max-height` cap so
  long verifier notes plus quotes are no longer cut off.
- **Consistent copy casing.** Footer attribution is now fully sentence-cased.

## [0.4.0]

- Refocused on a hardened **UK/English-only MVP**: removed non-English locales and the
  translate-in / translate-out pipeline steps; added a second-pass `verify` step
  (per-category reference-example matching), `url-safety` SSRF hardening, sensitive-token
  stripping, and structured `responseConstraint` output from the Prompt API.

## [0.2.1]

- Baseline: on-device Terms/EULA/privacy analysis with a deterministic A–F rubric,
  verbatim quote verification, side panel and in-page pill UI.
