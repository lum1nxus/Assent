const EU_TIMEZONES = new Set([
  "Europe/Vienna",
  "Europe/Brussels",
  "Europe/Sofia",
  "Europe/Zagreb",
  "Europe/Nicosia",
  "Europe/Prague",
  "Europe/Copenhagen",
  "Europe/Tallinn",
  "Europe/Helsinki",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Busingen",
  "Europe/Athens",
  "Europe/Budapest",
  "Europe/Dublin",
  "Europe/Rome",
  "Europe/Riga",
  "Europe/Vilnius",
  "Europe/Luxembourg",
  "Europe/Malta",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Lisbon",
  "Atlantic/Madeira",
  "Atlantic/Azores",
  "Europe/Bucharest",
  "Europe/Bratislava",
  "Europe/Ljubljana",
  "Europe/Madrid",
  "Atlantic/Canary",
  "Europe/Stockholm",
]);

const EEA_TIMEZONES = new Set([
  "Europe/Oslo",
  "Europe/Reykjavik",
  "Atlantic/Reykjavik",
  "Europe/Vaduz",
]);

const NON_EU_EUROPEAN_TIMEZONES = new Set([
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "Europe/Samara",
  "Europe/Volgograd",
  "Europe/Saratov",
  "Europe/Astrakhan",
  "Europe/Ulyanovsk",
  "Europe/Kirov",
  "Europe/Simferopol",
  "Europe/Minsk",
  "Europe/Kyiv",
  "Europe/Kiev",
  "Europe/Uzhgorod",
  "Europe/Zaporozhye",
  "Europe/London",
  "Europe/Jersey",
  "Europe/Guernsey",
  "Europe/Isle_of_Man",
  "Europe/Gibraltar",
  "Europe/Zurich",
  "Europe/Belgrade",
  "Europe/Sarajevo",
  "Europe/Skopje",
  "Europe/Tirane",
  "Europe/Podgorica",
  "Europe/Pristina",
  "Europe/Chisinau",
  "Europe/Tiraspol",
  "Europe/Istanbul",
  "Europe/Andorra",
  "Europe/Monaco",
  "Europe/San_Marino",
  "Europe/Vatican",
  "Europe/Mariehamn",
]);

const COUNTRY_TO_REGION = {
  AT: "eu",
  BE: "eu",
  BG: "eu",
  HR: "eu",
  CY: "eu",
  CZ: "eu",
  DK: "eu",
  EE: "eu",
  FI: "eu",
  FR: "eu",
  DE: "eu",
  GR: "eu",
  HU: "eu",
  IE: "eu",
  IT: "eu",
  LV: "eu",
  LT: "eu",
  LU: "eu",
  MT: "eu",
  NL: "eu",
  PL: "eu",
  PT: "eu",
  RO: "eu",
  SK: "eu",
  SI: "eu",
  ES: "eu",
  SE: "eu",
  IS: "eu",
  LI: "eu",
  NO: "eu",
  GB: "non-eu",
  CH: "non-eu",
  RU: "non-eu",
  BY: "non-eu",
  UA: "non-eu",
  TR: "non-eu",
  RS: "non-eu",
  BA: "non-eu",
  MK: "non-eu",
  AL: "non-eu",
  ME: "non-eu",
  MD: "non-eu",
  XK: "non-eu",
  US: "non-eu",
  CA: "non-eu",
  AU: "non-eu",
  NZ: "non-eu",
  JP: "non-eu",
  SG: "non-eu",
  AE: "non-eu",
  IN: "non-eu",
  BR: "non-eu",
  CN: "non-eu",
  HK: "non-eu",
};

const OVERRIDE_KEY = "user_region_override";

export async function detectUserRegion() {
  const override = await readOverride();
  if (override?.country) {
    return {
      country: override.country,
      region: COUNTRY_TO_REGION[override.country] ?? "unknown",
      source: "user_override",
    };
  }

  const fromTz = detectFromTimezone();
  if (fromTz.region !== "unknown") {
    return { ...fromTz, source: "timezone" };
  }

  const fromLocale = detectFromLocale();
  if (fromLocale.region !== "unknown") {
    return { ...fromLocale, source: "locale" };
  }

  return { country: null, region: "unknown", source: "none" };
}

export async function setUserRegionOverride(country) {
  try {
    const storage = chrome.storage?.sync ?? chrome.storage?.local;
    if (!storage) {
      return;
    }
    if (country === null) {
      await storage.remove(OVERRIDE_KEY);
      return;
    }
    if (typeof country !== "string" || !/^[A-Z]{2}$/.test(country)) {
      return;
    }
    await storage.set({ [OVERRIDE_KEY]: { country } });
  } catch {}
}

async function readOverride() {
  try {
    const storage = chrome.storage?.sync ?? chrome.storage?.local;
    if (!storage) {
      return null;
    }
    const stored = await storage.get(OVERRIDE_KEY);
    return stored?.[OVERRIDE_KEY] ?? null;
  } catch {
    return null;
  }
}

function detectFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) {
      return { country: null, region: "unknown" };
    }
    if (EU_TIMEZONES.has(tz) || EEA_TIMEZONES.has(tz)) {
      return { country: null, region: "eu" };
    }
    if (NON_EU_EUROPEAN_TIMEZONES.has(tz)) {
      return { country: null, region: "non-eu" };
    }
    if (tz.startsWith("America/") || tz.startsWith("Asia/") || tz.startsWith("Australia/")) {
      return { country: null, region: "non-eu" };
    }
    return { country: null, region: "unknown" };
  } catch {
    return { country: null, region: "unknown" };
  }
}

function detectFromLocale() {
  try {
    const locale = chrome.i18n?.getUILanguage?.() ?? navigator?.language ?? "";
    const parts = String(locale).split("-");
    const region = parts[1]?.toUpperCase();
    if (region && /^[A-Z]{2}$/.test(region)) {
      const mapped = COUNTRY_TO_REGION[region];
      if (mapped) {
        return { country: region, region: mapped };
      }
    }
    return { country: null, region: "unknown" };
  } catch {
    return { country: null, region: "unknown" };
  }
}
