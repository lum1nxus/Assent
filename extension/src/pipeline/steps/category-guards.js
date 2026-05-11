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
  user_retains_content_ownership: [/(own|owner|retain)/i, /(content|material|work|post)/i],
};

export function quoteMatchesCategoryKeywords(quote, category, kind) {
  const map = kind === "flag" ? FLAG_KEYWORD_GUARDS : CREDIT_KEYWORD_GUARDS;
  const patterns = map[category];
  if (!patterns || patterns.length === 0) {
    return true;
  }
  return patterns.every((re) => re.test(quote));
}
