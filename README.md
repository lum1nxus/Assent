# Assent

> Reads the Terms of Service so you don't have to. Shows a risk score before you click "I Agree".

Assent is a Chrome extension that analyses Terms of Service documents and gives you a 0–10 risk score plus a plain-language summary of the most user-hostile clauses. It runs **entirely on your device** — there are no servers, no API keys, no telemetry, and no cost.

EU jurisdiction first. English UI plus localised UI for German, French, Italian, Polish, and Dutch.

## Why

Most people click "I Agree" without reading 30 pages of legalese. The clauses that matter — mandatory arbitration, AI training on your content, indefinite data retention, broad content licenses — are often buried where you won't find them. Assent surfaces them with a verbatim quote so you can verify the finding in the original document.

## How it works

```
content.js  detects ToS pages or signup forms with ToS links
   │
   ▼
background.js (orchestrator) runs the pipeline:
   │
   ├─ static-db        — instant lookup in our EU-curated database
   ├─ extract          — semantic section extraction (top relevant 1800 words)
   ├─ detect-lang      — Chrome built-in Language Detector API
   ├─ translate-in     — Chrome built-in Translator API (any → EN)
   ├─ analyze          — Chrome built-in Language Model (Gemini Nano)
   ├─ translate-out    — translates descriptions to your UI language
   └─ persist          — chrome.storage.session
   │
   ▼
side panel renders the result; click "Show in document" highlights
the verbatim quote in the original ToS page.
```

No keys. No cloud calls. The first call to a language pair downloads the model;
subsequent calls are fully offline.

### Requirements

- Chrome 138+ (stable). For the on-device AI pipeline:
  - macOS 13+, Windows 10/11, or Linux desktop
  - 4 GB+ VRAM **or** 16 GB RAM + 4 CPU cores
  - 22 GB free disk for the model
- Devices that don't meet these requirements still get full static-database results.

## Install (development)

1. Clone this repo.
2. Open `chrome://extensions/`, enable Developer Mode.
3. "Load unpacked" → select the `extension/` folder.
4. Click the Assent action icon — the side panel opens.
5. Visit any service in the static DB (e.g. `spotify.com/legal/end-user-agreement`)
   to see an instant result, or any unknown ToS to trigger on-device AI.

## Architecture

| Folder                                                 | What it does                                    |
| ------------------------------------------------------ | ----------------------------------------------- |
| `extension/manifest.json`                              | MV3 manifest with i18n placeholders             |
| `extension/_locales/{en,de,fr,it,pl,nl}/messages.json` | UI strings — chrome.i18n                        |
| `extension/data/services.json`                         | Curated EU-jurisdiction database (~15 services) |
| `extension/src/background.js`                          | Service worker — orchestrator entry             |
| `extension/src/content.js`                             | DOM detection + click-to-highlight              |
| `extension/src/pipeline/index.js`                      | Chain-of-responsibility pipeline runner         |
| `extension/src/pipeline/steps/`                        | 7 pipeline steps                                |
| `extension/src/features/`                              | Grade A–F, top-3, alternative, donation         |
| `extension/src/sidepanel/`                             | Side panel UI                                   |

## Pipeline pattern

Every analysis step is a pure async function `(input, ctx) => { value, done? }`.
Steps can short-circuit (`done: true`), throw (orchestrator wraps the error
with the step name), or pass through to the next step. This makes each step
testable in isolation and lets us add new steps (alternative suggestion,
change tracking) without refactoring.

See [`extension/src/pipeline/index.js`](extension/src/pipeline/index.js).

## Differentiating features

| Feature                                         | Assent  | ToS;DR          | PrivacySpy      |
| ----------------------------------------------- | ------- | --------------- | --------------- |
| On-device AI for unknown ToS                    | yes     | no              | no              |
| Multilingual UI (EU languages)                  | yes (6) | no              | no              |
| AI output translation per user language         | yes     | no              | no              |
| Click-to-highlight verbatim quote in document   | yes     | no              | no              |
| Privacy-first (no cloud)                        | yes     | requires server | requires server |
| Better-alternative suggestion (by service type) | yes     | no              | no              |
| Grade letter A–F                                | yes     | yes             | no              |
| Open source                                     | MIT     | AGPL-3          | yes             |

## Donations

Assent is built and maintained by one developer. If it helps you, consider
buying me a coffee — it keeps the project alive. The donation card appears
inside the side panel only after you've used Assent for at least 7 days and
analysed 10+ services, and never blocks the UI.

PayPal.Me link with €10 prefilled: see [donation.js](extension/src/features/donation.js).

## Legal

This extension performs **automated pattern detection on publicly available
Terms of Service documents**. It is not legal advice. Each flag is backed by
a verbatim quote from the document so you can verify the finding yourself.
Scores reflect language patterns and do not capture every nuance.

## License

MIT — see [LICENSE](LICENSE).
