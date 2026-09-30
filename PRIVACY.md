# Privacy Policy for Assent

- **Effective date:** 4 August 2026
- **Applies to:** Assent browser extension, version 0.4.0 and later
- **Contact:** https://github.com/lum1nxus/Assent/issues

## 1. Summary

Assent reads a Terms of Service, EULA, or privacy policy that you are looking at, analyses it, and shows you a risk score with flagged clauses.

All analysis happens on your own device, inside your own browser, using Chrome's built-in AI model. Assent has no server, no backend, no API key, and no user accounts. **The developer of Assent never receives your browsing data, the documents you analyse, or any information about how you use the extension.** There is no analytics, no telemetry, no crash reporting, no advertising, and no third-party tracking of any kind.

Assent does not read any page until you explicitly ask it to by pressing **Scan this page**.

## 2. What Assent does not collect

Assent does not collect, transmit, sell, rent, or share any of the following:

- Personally identifiable information (name, address, email, age, identification number)
- Health, financial, or payment information
- Authentication information (passwords, credentials, tokens, cookies)
- Personal communications (email, messages, chat logs)
- Location data
- Browsing history, or a record of the sites or pages you visit
- Keystrokes, mouse movement, clicks, or any other behavioural or usage analytics
- Device or user identifiers, advertising IDs, or fingerprints

Assent creates no user profile, and it does not maintain any stored list, ranking, or database of the companies or documents that users analyse.

## 3. What data Assent handles, when, and why

Everything below stays on your device. "Handles" means the data is processed locally in your browser; it does not mean the data is sent anywhere.

### 3.1 Page content — only when you press Scan

When you press **Scan this page**, Assent injects a script into the current tab and extracts the visible text of that page. This text is passed to Chrome's on-device AI model to identify clauses, and to a scoring function that runs entirely in local JavaScript.

This is the core purpose of the extension and it cannot be disabled, but it only ever happens in response to your explicit action. By default Assent holds no standing permission to read any website: it relies on `activeTab`, a transient permission Chrome grants only for the tab whose toolbar icon you clicked, and which Chrome revokes as soon as you navigate away.

Assent does not read pages in the background, on a timer, or on page load.

### 3.2 Page address (URL) and domain

The domain of the analysed page is shown in the side panel next to the result and is stored with the result so the panel can tell which tab a result belongs to.

The side panel also compares the address of the **currently active tab** against the result it is displaying — when the panel opens, when you switch tabs, and when the active tab navigates — so that it can clear a result that no longer belongs to the page in front of you. Assent can see that address only for a tab you have already invoked it on (via `activeTab`), or, if you grant the optional all-sites permission described in section 5, for the active tab generally.

That address is used for this comparison and nothing else. It is not logged, not written to storage, not transmitted, and no history of the addresses you visit is accumulated.

The toolbar-icon hint that suggests a page may contain terms is implemented with Chrome's `declarativeContent` API. Chrome evaluates those URL rules internally and only tells the extension that a rule matched. The extension does not receive the URLs of pages you visit through this mechanism.

### 3.3 Terms documents linked from the page you scanned

If the page you scan is not itself an agreement but links to one, Assent may request that linked document directly so it can analyse the actual terms rather than the page you were on. That request goes to the website hosting the document, exactly as it would if you clicked the link yourself. No information about you is added to the request, and no copy of the document is sent anywhere else.

### 3.4 Local preferences

Assent stores a small number of settings in your browser's local extension storage:

- **Whether first-run setup has been completed** — so setup is not shown to you again.
- **Whether you have completed your first scan** — so one-time hints are shown only once.
- **Donation prompt state** (shown, postponed, declined, or followed) — so the prompt respects your choice instead of repeating itself.

These contain no personal information and never leave your device.

## 4. Where results are stored, and for how long

Analysis results are written to Chrome's **session storage** for the extension, which exists only in memory and is erased when Chrome shuts down. A stored result contains the analysed domain, the score and grade, the flagged clauses, and the verbatim excerpts the flags refer to.

Assent deletes a stored result as soon as it is no longer relevant: when the tab is closed, and when the tab navigates to another page. Results are never written to disk-backed storage, never synced across your devices, and never uploaded.

Assent also includes an optional diagnostic view that can display the raw text sent to the model and the model's raw response, so that a user reporting a problem can inspect and share what actually happened. That diagnostic data is retained only when you have explicitly turned on diagnostic mode, is held in the same in-memory session storage, and is shown only to you. Nothing is submitted automatically; if you choose to attach it to a bug report, you decide what to include.

## 5. Permissions, and why each one is requested

- **`activeTab`** — read the text of the one page you asked to scan, and only after you click the toolbar icon.
- **`scripting`** — inject the extraction script into that page on demand.
- **`storage`** — keep the result for the current session and remember the preferences listed in section 3.4.
- **`sidePanel`** — show the results panel.
- **`declarativeContent`** — let Chrome hint that a page may contain terms, without disclosing the page address to the extension.

Assent requests **no host permissions by default**, and registers **no automatic content scripts**.

Because Chrome drops `activeTab` on every navigation, the default flow requires clicking the toolbar icon on each new page. As a convenience you may **optionally** grant access to all sites (`*://*/*`) from the side panel. This is off unless you explicitly grant it, you can revoke it at any time in `chrome://extensions`, and even while granted it does not cause any page to be read automatically — Assent still reads a page only when you press **Scan**. What it does broaden is the address comparison described in section 3.2: instead of seeing the address only of tabs you have invoked Assent on, the panel can see the address of the active tab generally.

## 6. Chrome's built-in AI model and Google

Assent uses the AI model built into Chrome (Gemini Nano) through Chrome's Prompt API. The model runs locally on your device, and the text of the documents you analyse is processed on your device.

The model itself is not shipped with Assent. The first time it is needed, **Chrome** downloads it from Google, in the same way Chrome downloads its other components. That download is performed by the browser, not by Assent, and it is subject to [Google's Privacy Policy](https://policies.google.com/privacy) and the [Google Chrome Privacy Notice](https://www.google.com/chrome/privacy/). Assent cannot see, and does not receive, any information exchanged during that download. Assent only asks Chrome whether the model is available and, if you approve, asks Chrome to make it available.

Once the model is present, the analysis itself requires no network connection. The only request Assent can make on its own is fetching a linked terms document, as described in section 3.3.

## 7. Donations

Assent is free. It may occasionally offer a link to donate. Choosing that link opens PayPal in a new tab, where any payment is handled entirely by PayPal under PayPal's own privacy policy. Assent does not process, receive, or store payment details, and it does not learn whether you completed a payment — only, locally, that you followed the link, so it stops asking.

## 8. Limited Use commitment

Assent's use of data complies with the Chrome Web Store [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) requirements. Specifically:

- Data accessed by Assent is used **only** to provide the user-facing feature described in this policy: analysing a document the user asked to have analysed, and displaying the result to that user.
- Assent does **not** transfer that data to any third party, except as required by law.
- Assent does **not** use or transfer that data for advertising, marketing, retargeting, personalisation, or credit-worthiness purposes.
- Assent does **not** sell that data.
- No human, including the developer, reads or has any means of accessing the data Assent processes, because that data never leaves the user's device.

## 9. Your controls

- **Do not scan.** Assent reads nothing until you press Scan.
- **Delete results now.** Close the tab, navigate away, or close Chrome. Session data is discarded.
- **Reset preferences.** Remove the extension's stored settings from `chrome://extensions`, or reinstall the extension.
- **Revoke the optional all-sites permission** at any time in `chrome://extensions` → Assent → Site access.
- **Uninstall.** Removing Assent removes all data it stored. Nothing is retained anywhere else, because nothing was ever sent anywhere else.

## 10. Children

Assent is a general-purpose tool for reading legal documents. It is not directed at children, and it collects no data from anyone, including children.

## 11. Changes to this policy

If this policy changes materially, the effective date above will be updated and the change will be recorded in [CHANGELOG.md](CHANGELOG.md). Because Assent collects nothing, a change here reflects a change in what the extension does locally, not a change in what is collected about you.

## 12. Contact

Questions, corrections, or concerns: please open an issue at https://github.com/lum1nxus/Assent/issues.

Assent is open source. Every claim in this policy can be checked against the source code in this repository — the relevant paths are `extension/manifest.json` for permissions, `extension/src/background.js` and `extension/src/content.js` for when a page is read, and `extension/src/pipeline/steps/persist.js` for what is stored.
