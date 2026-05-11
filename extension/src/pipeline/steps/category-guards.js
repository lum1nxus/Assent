export const FLAG_KEYWORD_GUARDS = {
  mandatory_arbitration: [/\barbitrat/i],
  class_action_waiver: [/class[\s-]?(action|wide|arbitrat)|collective[\s-](action|proceeding)/i],
  broad_content_license_irrevocable: [
    /licen[sc]e/i,
    /perpetual|irrevocable|worldwide|royalty[\s-]?free|sublicense/i,
  ],
  unilateral_terms_change_no_notice: [
    /(modif|chang|amend|update|revise|alter)/i,
    /(terms|agreement|condition|polic)/i,
  ],
  data_resale_undisclosed_parties: [
    /(sell|sale|resell|trade|monet[iy]z)/i,
    /(data|information|personal)/i,
  ],
  broad_indemnity_from_user: [/indemnif|indemnit|hold\s+(us|them|.+)\s+harmless/i],
  broad_limitation_of_liability: [/(liabilit|liable|damages|loss(?:es)?)/i],
  broad_warranty_disclaimer: [/(warrant|merchantab|fitness for|disclaim)/i],
  broad_data_sharing_third_party: [
    /(third[\s-]?part|partner|affiliate|advertiser)/i,
    /(shar|disclos|provid)/i,
  ],
  account_termination_no_notice: [
    /(terminat|suspend|deactivat|disabl)/i,
    /(account|access|service)/i,
  ],
  content_removal_sole_discretion: [
    /(remov|delete|take[\s-]?down|disabl)/i,
    /(content|post|material)/i,
  ],
  auto_renewal_no_clear_optout: [/(auto|automatic)[\s-]?renew|recurring/i],
  retention_period_undefined: [/retain|retention|keep|store/i],
  governing_law_distant_venue: [/(venue|jurisdiction|forum|court)/i],
  services_as_is: [/as[\s-]?is|as[\s-]?available/i],
  other_unfavourable_clause: [],
};

export const CREDIT_KEYWORD_GUARDS = {
  explicit_refund_window: [/refund|money[\s-]?back/i, /(\d+\s*(day|week|month)|within)/i],
  easy_account_deletion: [/(delet|cancel|close|remov)/i, /account/i],
  explicit_optin_data_sharing: [/(opt[\s-]?in|consent|with your permission|explicit consent)/i],
  no_automatic_renewal: [/(not|no|won't|will not|do not)/i, /(auto|automatic)?[\s-]?renew/i],
  transparent_retention_period: [
    /(retain|retention|keep|store|delete)/i,
    /\d+\s*(day|week|month|year)/i,
  ],
  free_data_export: [/(export|download|portable|takeout)/i, /(data|information)/i],
  arbitration_optout_window: [/arbitrat/i, /(opt[\s-]?out|decline|reject)/i],
  user_retains_content_ownership: [
    /(own|owner|ownership|retain|retention|remains|stays)/i,
    /(content|material|work|post|submission|upload)/i,
    /\b(you|users?|your|users')\b/i,
  ],
};

const CREDIT_INVERSE_PATTERNS = {
  user_retains_content_ownership: [
    /\b(?:we|our (?:company|service|platform)|the\s+(?:service|platform|provider|company|application))\s+(?:and\/or\s+(?:its|our)\s+licensors?\s+)?(?:are|is)\s+the\s+(?:sole\s+)?owners?\b/i,
    /\bsole\s+owners?\s+of\s+all\s+rights?\s+(?:to|in)\b/i,
    /\b(?:we|the\s+(?:service|company|provider|platform))\s+(?:own|owns|reserve|retain)\s+(?:all|the)\s+(?:right|title|intellectual\s+property|content)\b/i,
    /\b(?:provider|service|platform|company|application)['\u2019]s\s+licensors?\b/i,
  ],
  easy_account_deletion: [
    /\b(?:we|the\s+(?:service|provider|platform|company))\s+(?:may|can|reserve\s+the\s+right\s+to|will|shall)\s+(?:terminat|delet|disabl|deactivat|suspend|close|remov)/i,
  ],
  explicit_optin_data_sharing: [
    /\bby\s+(?:using|accessing|signing\s+up|registering|continuing\s+to\s+use)\s+(?:the\s+)?(?:service|site|platform|application)/i,
    /\bdeemed\s+(?:to\s+have\s+)?(?:consent|agreed)/i,
    /\b(?:we|the\s+(?:service|provider))\s+(?:may|will|shall|can)\s+(?:sell|share|disclose|trade)/i,
  ],
  no_automatic_renewal: [
    /\b(?:will|shall|do|does)\s+(?:automatically\s+)?renew/i,
  ],
};

export function creditQuoteIsInverted(quote, category) {
  if (typeof quote !== "string" || quote.length === 0) {
    return false;
  }
  const patterns = CREDIT_INVERSE_PATTERNS[category];
  if (!patterns) {
    return false;
  }
  return patterns.some((p) => p.test(quote));
}

const FLAG_NEGATION_PATTERNS = [
  /\bdoes not apply\b/i,
  /\bwill not apply\b/i,
  /\bshall not apply\b/i,
  /\bnot subject to\b/i,
  /\b(?:will|do|does|shall|would|may|can)\s+not\s+(?:sell|share|disclose|trade|rent|lease|transfer|provide|use|process)\b/i,
  /\b(?:don't|doesn't|won't|wouldn't|can't|cannot|couldn't|shouldn't)\s+(?:sell|share|disclose|trade|rent|lease|transfer|provide|use|process)\b/i,
  /\bwith(?:\s+the)?\s+(?:user'?s?|customer'?s?|your|consumer'?s?|reader'?s?)\s+(?:prior\s+)?(?:explicit\s+|written\s+|express\s+)?(?:consent|permission|approval|agreement|authorization)\b/i,
  /\bwith(?:\s+the)?\s+(?:prior\s+)?(?:explicit\s+|written\s+|express\s+)?(?:consent|permission|approval|agreement|authorization)\s+of\s+(?:the\s+)?(?:user|customer|consumer|reader|subscriber|client|you)\b/i,
  /\bonly\s+(?:with|after|upon|if)\s+(?:your|user|customer)\s+(?:consent|permission|opt[\s-]?in|approval)\b/i,
  /\bopt[\s-]?in\s+(?:only|required|basis|first)\b/i,
  /\b(?:we|our company|the (?:service|provider|company|platform))\s+(?:does|do|will|shall|would|may)\s+not\b/i,
  /\bunder no circumstances will (?:we|our|the (?:service|provider|company))\s+(?:sell|share|disclose|trade|rent|lease|transfer)\b/i,
];

export function quoteContainsNegation(quote) {
  if (typeof quote !== "string" || quote.length === 0) {
    return false;
  }
  return FLAG_NEGATION_PATTERNS.some((p) => p.test(quote));
}

const SPLICE_MARKERS = [/\.\.\./, /\u2026/, /\[\s*\.\.\.\s*\]/, /\[\s*omitted\s*\]/i];

export function quoteLooksSpliced(quote) {
  if (typeof quote !== "string" || quote.length === 0) {
    return false;
  }
  return SPLICE_MARKERS.some((p) => p.test(quote));
}

export function quoteMatchesCategoryKeywords(quote, category, kind) {
  const map = kind === "flag" ? FLAG_KEYWORD_GUARDS : CREDIT_KEYWORD_GUARDS;
  const patterns = map[category];
  if (!patterns || patterns.length === 0) {
    return true;
  }
  return patterns.every((re) => re.test(quote));
}
