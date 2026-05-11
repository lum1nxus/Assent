/**
 * Donation popup logic — shown only when the user has gotten real value
 * from Assent and is currently looking at a result.
 *
 * Funded by PayPal.Me with a €10 prefilled donation link. Username is the
 * only configurable bit; change PAYPAL_USERNAME to your handle after
 * registering at https://paypal.me/.
 *
 * Trigger requires ALL of:
 *   1. ≥ MIN_DAYS_SINCE_INSTALL days since first use
 *   2. ≥ MIN_ANALYSES analyses successfully completed
 *   3. ≥ MIN_DAYS_SINCE_PROMPT days since last shown (default 90)
 *   4. User hasn't permanently dismissed
 */

const PAYPAL_USERNAME = "vaclavgordienko";
const PAYPAL_AMOUNT = "10EUR";

const MIN_DAYS_SINCE_INSTALL = 7;
const MIN_ANALYSES = 10;
const MIN_DAYS_SINCE_PROMPT = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = "assent_donation_state";

const DEFAULT_STATE = {
  firstUse: null,
  analysisCount: 0,
  lastDonationPrompt: null,
  dismissedForever: false,
};

export const PAYPAL_LINK = `https://paypal.me/${PAYPAL_USERNAME}/${PAYPAL_AMOUNT}`;
export const PAYPAL_LINK_CHOOSE_AMOUNT = `https://paypal.me/${PAYPAL_USERNAME}`;

/**
 * Load donation state from chrome.storage.local.
 * Initializes `firstUse` on first call.
 */
export async function loadState() {
  const stored = await chrome.storage.local.get(KEY);
  const state = { ...DEFAULT_STATE, ...(stored[KEY] ?? {}) };
  if (state.firstUse === null) {
    state.firstUse = Date.now();
    await chrome.storage.local.set({ [KEY]: state });
  }
  return state;
}

/**
 * Increment the analysis counter — called after each successful analysis
 * (whether from static DB or AI).
 */
export async function incrementAnalysisCount() {
  const stored = await chrome.storage.local.get(KEY);
  const state = { ...DEFAULT_STATE, ...(stored[KEY] ?? {}) };
  if (state.firstUse === null) {
    state.firstUse = Date.now();
  }
  state.analysisCount = (state.analysisCount ?? 0) + 1;
  await chrome.storage.local.set({ [KEY]: state });
}

/**
 * Should the donation card be displayed right now?
 * Returns true ONLY if all trigger conditions are met.
 */
export async function shouldShowDonation() {
  const state = await loadState();
  if (state.dismissedForever) {
    return false;
  }
  if ((state.analysisCount ?? 0) < MIN_ANALYSES) {
    return false;
  }

  const now = Date.now();
  const daysSinceInstall = state.firstUse ? (now - state.firstUse) / DAY_MS : 0;
  if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) {
    return false;
  }

  if (state.lastDonationPrompt) {
    const daysSincePrompt = (now - state.lastDonationPrompt) / DAY_MS;
    if (daysSincePrompt < MIN_DAYS_SINCE_PROMPT) {
      return false;
    }
  }

  return true;
}

/** "Maybe later" — snooze for MIN_DAYS_SINCE_PROMPT days. */
export async function snoozeDonation() {
  const stored = await chrome.storage.local.get(KEY);
  const state = { ...DEFAULT_STATE, ...(stored[KEY] ?? {}) };
  state.lastDonationPrompt = Date.now();
  await chrome.storage.local.set({ [KEY]: state });
}

/** "No thanks" — never show again. */
export async function dismissForever() {
  const stored = await chrome.storage.local.get(KEY);
  const state = { ...DEFAULT_STATE, ...(stored[KEY] ?? {}) };
  state.dismissedForever = true;
  state.lastDonationPrompt = Date.now();
  await chrome.storage.local.set({ [KEY]: state });
}

export const DONATION_CONSTANTS = {
  PAYPAL_USERNAME,
  PAYPAL_AMOUNT,
  MIN_DAYS_SINCE_INSTALL,
  MIN_ANALYSES,
  MIN_DAYS_SINCE_PROMPT,
};
