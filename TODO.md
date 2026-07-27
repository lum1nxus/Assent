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

If the user presses **Scan this page** on a page that is *not* a terms / EULA /
privacy / agreement document (e.g. a random article, a dashboard, a search result),
we must **not** feed arbitrary page text to the model and risk hallucinated flags or a
misleading grade. Instead: recognise "this isn't an agreement page" and show a calm,
explicit message like *"This doesn't look like a terms or agreement page — open a
Terms of Service, EULA, or privacy policy and scan again."*

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

## Other ideas

- (add future items here)
