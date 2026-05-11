# Testing Assent locally

Assent has three test layers. Layers 1 and 2 run in pure Node without any
browser; layer 3 needs a real Chrome with the on-device model.

- **Layer 1 - unit tests** (fast, deterministic, no AI). Pure functions
  in `extension/src/pipeline/rubric/`, the JSON sanitiser, the keyword
  guards, and label resolution are exercised by `node --test`.
- **Layer 2 - AI-output replays** (fast, deterministic, no AI). Each
  JSON file under `tests/fixtures/ai-outputs/` is a captured or
  hand-authored `(documentText, rawAiResponse)` pair plus the
  `expectedFlags` and `expectedCredits` the pipeline should produce
  after every guard runs. The replay test loads all of them and asserts
  that `parseAndValidate` produces the expected output. This is where
  regressions captured from Chrome live forever.
- **Layer 3 - end-to-end in a real browser** (slow, requires Chrome
  148+ and an on-device model bundle). You drive a real Chrome session
  against real agreement pages and read the side panel.

## 0. Run the deterministic suites

```sh
npm test          # node --test on every tests/*.test.js
npm run eval      # human-readable summary of replays + corpus
npm run eval:verbose
```

`npm test` runs all 100+ assertions: rubric, sanitiser, keyword guards,
synthetic-corpus calibration, and AI-output replays.

`npm run eval` is a friendlier CLI that prints `pass / fail / total` per
suite and the score and grade for every fixture. Pass `--only=<substring>`
to filter, for example `npm run eval -- --only=negation`.

Linting and formatting:

```sh
npm run lint
npm run format:check
```

## 0a. The one-click debug workflow (preferred)

The side panel has a built-in capture tool so you never have to paste
DevTools snippets again. The bottom of every side panel shows the
extension version (for example `Assent v0.2.0`) next to a `Debug` button.

1. Reproduce the bug in Chrome. Wait for analysis to finish.
2. Open the side panel. Click `Debug` at the bottom.
3. A dialog appears with a JSON bundle containing:
   - the version that produced the result
   - the URL and domain
   - the persisted score, grade, flags, credits
   - `documentText` - the exact text sent to the model
   - `rawAiResponse` - the raw model output before any guard ran
   - extraction stats: word count, detected language, jurisdiction
4. Click `Download .json` to save the bundle locally, or `Copy` to put
   it on the clipboard.

You can now replay that exact case in pure Node without a browser:

```sh
npm run replay -- /path/to/assent-debug-<...>.json
```

The replay prints what `parseAndValidate` and the rubric produce now,
compared to what was persisted in Chrome at capture time. Any difference
is a guard or rubric change since the bundle was captured.

To lock the case in as a permanent regression test:

```sh
npm run replay -- /path/to/bundle.json --save-as captured-<short-id>
```

This writes a fixture to `tests/fixtures/ai-outputs/captured-<short-id>.json`
with the replay output already filled in as `expectedFlags` and
`expectedCredits`. If the captured behaviour is the bug we want to fix,
edit those fields to the output you want after the fix - the new test
will fail until the guard or prompt is updated, then it locks the fix
in place.

The bundle name also encodes the extension version, so you can always
tell whether a screenshot or a captured file came from an old build.

## 0b. Adding a new AI-output regression test by hand

If you cannot reproduce the bug in Chrome (for example you only have a
screenshot or a quote), you can still author a fixture manually:

1. Create `tests/fixtures/ai-outputs/<name>.json` with the keys
   documented in `tests/fixtures/ai-outputs/README.md`.
2. `npm test` and `npm run eval` will report the new fixture.

This means every reported bug ships with its own regression test before
the fix lands.

## 1. Layer 3 - real Chrome end-to-end test

### Browser requirements

- **Chrome 148 or newer** on desktop (regular Chrome, Canary, or Dev all
  work). Mobile Chrome does not expose the Prompt API.
- At least 8 GB of RAM and a few GB of free disk space (Gemini Nano is
  roughly 2.7 GB on the CPU build or 4 GB on the GPU build, plus runtime
  caches).

The Prompt API has been on by default in desktop Chrome since version 148.
The Translator and Language Detector APIs have been stable since Chrome 138.
There are no Chrome flags to enable for the happy path; if `availability()`
ever returns `"unavailable"`, see the workaround in section 4.

## 2. Provision the on-device model

Open `chrome://on-device-internals/` and look at the **Model Status** tab.

- If you see `Model Name: v3Nano` with a `Backend Type` of GPU or CPU and a
  status of `Loaded`, skip ahead to section 3.
- If the page reports the model is missing or unavailable, continue here.

Chrome only starts the download once an API call is made from a page after a
user interaction. The simplest way to trigger it manually:

1. Open any web page (for example `https://example.com`).
2. Open DevTools (F12) and switch to the Console.
3. Check availability:

   ```js
   await LanguageModel.availability();
   ```

4. If it returns `"downloadable"`, request a session and watch progress:

   ```js
   await LanguageModel.create({
     monitor(m) {
       m.addEventListener("downloadprogress", (e) =>
         console.log(`${(e.loaded * 100).toFixed(1)}%`),
       );
     },
   });
   ```

The download is a few GB; first install takes a few minutes on a fast
connection. After the bundle is unpacked, the model is shared with every
page and extension running in the same Chrome profile.

Confirm Translator and Language Detector are also ready:

```js
await Translator.availability({ sourceLanguage: "de", targetLanguage: "en" });
await LanguageDetector.availability();
```

## 3. Load Assent as an unpacked extension

1. Open `chrome://extensions/`.
2. Toggle **Developer mode** in the upper right.
3. Click **Load unpacked** and select the `extension/` directory of this
   repository (not the repository root).
4. Pin Assent to the toolbar so the badge text is visible while pages load.

After any edit under `extension/`, click the reload icon on the Assent row
in `chrome://extensions/` and then reload the page you are testing on.

## 4. Try it on a real document

Open any consumer-facing agreement page, for example:

- a streaming-service terms page
- a social-platform terms page
- a messenger terms page
- a retail or marketplace terms page
- a fintech or payments terms page

A small floating pill appears in the lower right of the page while analysis
is running, and shows a grade letter when the analysis finishes. Click the
pill or the toolbar icon to open the side panel with the full result.

The side panel renders:

- the grade letter and the numeric risk score
- a deterministic two-clause summary built from the highest-impact flags
- the top three flagged clauses with verbatim quotes
- the full list of flagged clauses, each with a "Show in document" button
- credits, if any genuinely consumer-protective clauses were detected
- the methodology link and the analysed-at timestamp

Clicking any "Show in document" button scrolls the underlying page and
highlights the exact quoted substring.

### If `LanguageModel.availability()` returns `unavailable`

Chrome decided the machine does not meet its performance bar (low VRAM, GPU
on the internal blocklist, or the benchmark failed). Bypass:

`chrome://flags/#optimization-guide-on-device-model` → **Enabled
BypassPerfRequirement** → relaunch Chrome → retry section 2.

This is currently the only relevant flag.

## 5. Verifying multilingual behaviour

- Open a non-English terms page (German, Polish, Russian, Slovak, Turkish,
  etc.). Detection should still trigger, the document is translated to
  English for analysis, and the verdict is rendered in your Chrome UI
  language. The extension ships strings for 29 European locales:
  be, bg, ca, cs, da, de, el, en, es, et, fi, fr, hr, hu, it, lt, lv, nl,
  no, pl, pt_PT, ro, ru, sk, sl, sr, sv, tr, uk.
- Switch your Chrome UI language in Chrome settings, reload the Assent row
  in `chrome://extensions/`, then reload the page to confirm the localized
  side panel.

Verbatim quotes are never translated - they remain in the document's
original language so they can be matched against the page.

## 6. Debugging

### Logs

- **Service worker logs**: `chrome://extensions/` → Assent → click
  _service worker_ → opens DevTools attached to the background script.
- **Content-script logs**: open DevTools on the inspected page (F12) and
  look at the page console.
- **Side-panel logs**: right-click anywhere inside the side panel and
  choose _Inspect_.
- **Model state**: `chrome://on-device-internals/` shows the current model
  version, backend, and any failures from the last download attempt.

### Dump per-tab analysis state

`background.js` exposes a `DUMP_STATE` message that returns the full
`chrome.storage.session` snapshot. Run it from the **service worker
DevTools console** (not a page console, the page does not have
`chrome.runtime`):

```js
chrome.runtime.sendMessage({ type: "DUMP_STATE" }, (all) =>
  console.log(JSON.stringify(all, null, 2)),
);
```

This is the fastest way to inspect what the pipeline produced for each tab.

### Clear all cached analyses for the profile

From the service worker DevTools console:

```js
chrome.storage.session.clear();
chrome.storage.local.clear(); // also resets donation prompt state
```

## 7. Building a Chrome Web Store zip

```sh
npm run zip
```

Produces `assent-<version>.zip` at the repository root, ready to upload to
the Chrome Web Store developer console. The script strips macOS `.DS_Store`
files automatically.
