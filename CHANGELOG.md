# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

## [0.4.0]

- Refocused on a hardened **UK/English-only MVP**: removed non-English locales and the
  translate-in / translate-out pipeline steps; added a second-pass `verify` step
  (per-category reference-example matching), `url-safety` SSRF hardening, sensitive-token
  stripping, and structured `responseConstraint` output from the Prompt API.

## [0.2.1]

- Baseline: on-device Terms/EULA/privacy analysis with a deterministic A–F rubric,
  verbatim quote verification, side panel and in-page pill UI.
