# Capturing a fixture from a real Chrome session

When a real document on a real Chrome with Gemini Nano produces an output you want to lock in as a regression test, run the snippet below to extract a fixture-shaped JSON object straight from `chrome.storage.session`.

## Prerequisites

- Chrome 138+ with the on-device AI flags enabled.
- The extension loaded from `extension/`.
- The page you want to capture analysed at least once (side-panel shows a result, not a spinner).

## Snippet

Open the **service worker** DevTools (chrome://extensions -> Assent -> Service worker -> Inspect) and paste this:

```js
(async () => {
  const all = await chrome.storage.session.get(null);
  const done = Object.entries(all).filter(([, v]) => v?.status === "done");
  const fixtures = done.map(([key, { result }]) => ({
    name: `captured-${result.domain}-${key.replace(/\D/g, "")}`,
    description: "captured from a real Gemini Nano session - fill this in",
    documentText: result._debug?.documentText ?? "",
    rawAiResponse: result._debug?.rawAiResponse ?? "",
    expectedFlags: result.flags.map(({ category, severity }) => ({ category, severity })),
    expectedCredits: result.credits.map(({ category }) => ({ category })),
    expectedReason: "describe what this fixture pins",
  }));
  console.log(JSON.stringify(fixtures, null, 2));
})();
```

## After running

1. Copy the printed JSON.
2. For each fixture, save it as `tests/fixtures/ai-outputs/captured-<short-id>.json` (one file per object).
3. Edit `expectedFlags`, `expectedCredits` and `expectedReason` to what you want the pipeline to produce after the fix lands. If the captured behaviour is currently wrong, that is fine - the test will fail until the prompt or a guard is fixed.
4. Run `npm test` and `npm run eval` to verify.

## What gets captured

`result._debug.documentText` is the exact passage fed to the on-device model. `result._debug.rawAiResponse` is the verbatim string the model returned (before any sanitisation or guard filtering). Together they fully reproduce the pipeline run in pure Node, with no Chrome involved.
