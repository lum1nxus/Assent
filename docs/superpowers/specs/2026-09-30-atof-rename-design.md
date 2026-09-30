# Rename Assent to AtoF - Design

Date: 2026-09-30
Status: Approved
Parent: `2026-09-30-atof-dev-reboot-design.md`, section 4, Phase 1 (rename part)

## Goal

Rename the project from Assent to AtoF everywhere it is named, without changing pipeline
logic, the rubric, or extension behaviour.

- Display name: `AtoF`
- Slug: `atof` (package name, identifiers, artefacts, GitHub repo)
- GitHub repo: `lum1nxus/Assent` becomes `lum1nxus/atof`

## Context

- The extension is not yet published to the Chrome Web Store, so there are no end users
  holding state under the old name. Only local development installs exist.
- GitHub keeps redirecting the old repo, issues, and blob URLs after a rename, as long as
  no new repo takes the old name.

## Decisions

| Topic                       | Decision                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Order                       | Rename the GitHub repo and update `origin` first, then edit on a feature branch       |
| GitHub repo name            | `atof` (lowercase, matches slug and local folder)                                     |
| Internal identifiers        | Renamed to `atof`, including the storage key, with no migration                       |
| CHANGELOG                   | New `[Unreleased] > Changed` entry; the one old-name mention in Unreleased is updated |
| README                      | One line under the title: `Formerly named Assent.`                                    |
| `PRIVACY.md` effective date | Unchanged: a rename is not a material change to data handling; recorded in CHANGELOG  |

Renaming the GitHub repo first means every new URL written into the code and docs resolves
from the first commit, while the old URLs keep working through the redirect.

## Changes

### Extension (user-facing)

- `extension/_locales/en/messages.json`: `extName` and every message containing "Assent".
- Fallback strings passed to `t(...)` in `extension/src/sidepanel/sidepanel.js`,
  `extension/onboarding.js`, and `extension/src/background.js`.
- Static titles in `extension/src/sidepanel/index.html` and `extension/onboarding.html`.
- Side panel footer: `AtoF v<version>`.
- `extension/manifest.json` needs no edit: it reads the name through `__MSG_extName__`.

### Extension (internal identifiers)

- `extension/src/content.js`: `assent-hl`, `assent-pulse`, `assent-spin`,
  `assent-floating-pill`, `assent-close`, `data-assent` become `atof-*` / `data-atof`.
- Log prefix `[Assent]` becomes `[AtoF]` in `content.js` and `background.js`.
- Debug bundle default name `assent-debug` becomes `atof-debug` in `sidepanel.js`.
- `extension/src/features/donation.js`: storage key `assent_donation_state` becomes
  `atof_donation_state`. No migration: the only effect is that a development install shows
  the donation prompt as if new.

### URLs

`https://github.com/lum1nxus/Assent` becomes `https://github.com/lum1nxus/atof` in:

- `extension/src/sidepanel/sidepanel.js` (`METHODOLOGY_URL`)
- `extension/src/pipeline/steps/persist.js` (`methodology_url` in the disclaimer; the
  `not_legal_advice` and `not_affiliated` flags are untouched)
- `package.json` (`homepage`, `repository.url`)
- `PRIVACY.md` (Contact line and section 8)
- `TODO.md` (the privacy policy URL given to the store)

### Build and packaging

- `package.json`: `name` becomes `atof`; the `zip` script builds `atof-<version>.zip`.
- `package-lock.json`: top-level `name` fields become `atof`.
- `.gitignore`: `assent-*.zip` becomes `atof-*.zip`.

### Documentation and rules

- `README.md`: title and prose become "AtoF"; `Formerly named Assent.` under the title;
  `npm run zip` artefact name.
- `PRIVACY.md`, `TESTING.md`, `scripts/capture.md`, `TODO.md`: "Assent" becomes "AtoF".
- `.cursor/rules/*.mdc`: the `description` frontmatter becomes "AtoF".
- `CHANGELOG.md`: add under `[Unreleased]`:

  ```markdown
  ### Changed

  - **Project renamed from Assent to AtoF.** The extension name, side panel, onboarding,
    in-page pill, privacy policy, and repository URL now use AtoF. Old repository links
    redirect to the new one.
  ```

  and change "Chrome's (not Assent's) role" to "Chrome's (not AtoF's) role".

## Out of scope

- Pipeline logic, rubric, scoring, and any behaviour change.
- `docs/superpowers/specs/2026-09-30-atof-dev-reboot-design.md`: a historical record that
  describes this rename; it keeps the old name.
- Replacing existing non-ASCII punctuation in the touched files beyond the lines edited.
- Icons and visual identity.
- The automated Layer 3 harness (separate Phase 1 spec).

## Verification

- `rg -i assent` matches only: the CHANGELOG entry, the README "Formerly named Assent"
  line, the dev-reboot spec, and this rename spec and its plan.
- `npm test && npm run lint && npm run format:check`.
- `npm run eval`, because `extension/src/pipeline/steps/persist.js` changes.
- `gh repo view lum1nxus/atof` succeeds and `git remote -v` points to
  `https://github.com/lum1nxus/atof.git`.
- Layer 3 in real Chrome, with the user loading `extension/` unpacked:
  - `chrome://extensions` and the toolbar tooltip show "AtoF";
  - the side panel title, document title, and footer show "AtoF";
  - the onboarding page title and heading show "AtoF";
  - a scan shows the in-page pill, and clicking a flag highlights the quote (confirms the
    renamed `atof-hl` class is consistent between style and marks);
  - service-worker and page console messages use the `[AtoF]` prefix;
  - the Methodology link opens `github.com/lum1nxus/atof#methodology`.

## Delivery

- Branch: `chore/rename-atof` from `main`.
- Commit and PR title: `chore: rename project to AtoF`.
