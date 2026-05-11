const PAYPAL_USERNAME = "slavagordienko";
const PAYPAL_AMOUNT = "10EUR";

const MIN_DAYS_SINCE_INSTALL = 1;
const MIN_ANALYSES = 2;

const SNOOZE_DAYS_MAYBE_LATER = 14;
const SNOOZE_DAYS_NO_THANKS = 30;
const SNOOZE_DAYS_AFTER_DONATION = 150;

const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = "assent_donation_state";

const DEFAULT_STATE = {
  firstUse: null,
  analysisCount: 0,
  lastDonationPrompt: null,
  lastAction: null,
};

export const PAYPAL_LINK = `https://paypal.me/${PAYPAL_USERNAME}/${PAYPAL_AMOUNT}`;
export const PAYPAL_LINK_CHOOSE_AMOUNT = `https://paypal.me/${PAYPAL_USERNAME}`;

async function readState() {
  const stored = await chrome.storage.local.get(KEY);
  const raw = stored[KEY] ?? {};
  const state = { ...DEFAULT_STATE, ...raw };
  if (raw.dismissedForever === true && !state.lastAction) {
    state.lastAction = "no_thanks";
  }
  return state;
}

async function writeState(state) {
  await chrome.storage.local.set({ [KEY]: state });
}

export async function loadState() {
  const state = await readState();
  if (state.firstUse === null) {
    state.firstUse = Date.now();
    await writeState(state);
  }
  return state;
}

export async function incrementAnalysisCount() {
  const state = await readState();
  if (state.firstUse === null) {
    state.firstUse = Date.now();
  }
  state.analysisCount = (state.analysisCount ?? 0) + 1;
  await writeState(state);
}

function snoozeDaysFor(lastAction) {
  switch (lastAction) {
    case "donated":
      return SNOOZE_DAYS_AFTER_DONATION;
    case "no_thanks":
      return SNOOZE_DAYS_NO_THANKS;
    case "maybe_later":
      return SNOOZE_DAYS_MAYBE_LATER;
    default:
      return SNOOZE_DAYS_MAYBE_LATER;
  }
}

export async function shouldShowDonation() {
  const state = await loadState();
  if ((state.analysisCount ?? 0) < MIN_ANALYSES) {
    return false;
  }

  const now = Date.now();
  const daysSinceInstall = state.firstUse ? (now - state.firstUse) / DAY_MS : 0;
  if (daysSinceInstall < MIN_DAYS_SINCE_INSTALL) {
    return false;
  }

  if (state.lastDonationPrompt) {
    const snoozeDays = snoozeDaysFor(state.lastAction);
    const daysSincePrompt = (now - state.lastDonationPrompt) / DAY_MS;
    if (daysSincePrompt < snoozeDays) {
      return false;
    }
  }

  return true;
}

async function recordAction(action) {
  const state = await readState();
  state.lastDonationPrompt = Date.now();
  state.lastAction = action;
  await writeState(state);
}

export async function recordDonationClick() {
  await recordAction("donated");
}

export async function snoozeDonation() {
  await recordAction("maybe_later");
}

export async function declineDonation() {
  await recordAction("no_thanks");
}

export const DONATION_CONSTANTS = {
  PAYPAL_USERNAME,
  PAYPAL_AMOUNT,
  MIN_DAYS_SINCE_INSTALL,
  MIN_ANALYSES,
  SNOOZE_DAYS_MAYBE_LATER,
  SNOOZE_DAYS_NO_THANKS,
  SNOOZE_DAYS_AFTER_DONATION,
};
