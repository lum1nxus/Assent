export const SEVERITY_MULTIPLIER = Object.freeze({
  high: 1.5,
  full: 1.0,
  partial: 0.5,
});

export const CATEGORIES = Object.freeze({
  mandatory_arbitration: { kind: "flag", weight: 18, msg: "catFlagMandatoryArbitration" },
  class_action_waiver: { kind: "flag", weight: 16, msg: "catFlagClassActionWaiver" },
  broad_content_license_irrevocable: {
    kind: "flag",
    weight: 16,
    msg: "catFlagBroadLicenseIrrevocable",
  },
  unilateral_terms_change_no_notice: {
    kind: "flag",
    weight: 14,
    msg: "catFlagUnilateralChange",
  },
  data_resale_undisclosed_parties: { kind: "flag", weight: 14, msg: "catFlagDataResale" },
  broad_indemnity_from_user: { kind: "flag", weight: 12, msg: "catFlagBroadIndemnity" },
  broad_limitation_of_liability: {
    kind: "flag",
    weight: 8,
    msg: "catFlagBroadLiabilityCap",
  },
  broad_warranty_disclaimer: {
    kind: "flag",
    weight: 7,
    msg: "catFlagBroadWarrantyDisclaimer",
  },
  broad_data_sharing_third_party: {
    kind: "flag",
    weight: 8,
    msg: "catFlagBroadDataSharing",
  },
  account_termination_no_notice: {
    kind: "flag",
    weight: 8,
    msg: "catFlagAccountTermination",
  },
  content_removal_sole_discretion: {
    kind: "flag",
    weight: 6,
    msg: "catFlagContentRemoval",
  },
  auto_renewal_no_clear_optout: { kind: "flag", weight: 7, msg: "catFlagAutoRenewal" },
  retention_period_undefined: {
    kind: "flag",
    weight: 5,
    msg: "catFlagRetentionUndefined",
  },
  governing_law_distant_venue: { kind: "flag", weight: 4, msg: "catFlagDistantVenue" },
  services_as_is: { kind: "flag", weight: 4, msg: "catFlagServicesAsIs" },
  other_unfavourable_clause: { kind: "flag", weight: 3, msg: "catFlagOtherUnfavourable" },

  explicit_refund_window: { kind: "credit", weight: 6, msg: "catCreditRefundWindow" },
  easy_account_deletion: { kind: "credit", weight: 6, msg: "catCreditEasyDeletion" },
  explicit_optin_data_sharing: {
    kind: "credit",
    weight: 5,
    msg: "catCreditOptinDataSharing",
  },
  no_automatic_renewal: { kind: "credit", weight: 4, msg: "catCreditNoAutoRenewal" },
  transparent_retention_period: {
    kind: "credit",
    weight: 4,
    msg: "catCreditTransparentRetention",
  },
  free_data_export: { kind: "credit", weight: 4, msg: "catCreditDataExport" },
  arbitration_optout_window: {
    kind: "credit",
    weight: 5,
    msg: "catCreditArbitrationOptout",
  },
  user_retains_content_ownership: {
    kind: "credit",
    weight: 6,
    msg: "catCreditUserOwnsContent",
  },
});

export const FLAG_CATEGORY_IDS = Object.freeze(
  Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].kind === "flag"),
);

export const CREDIT_CATEGORY_IDS = Object.freeze(
  Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].kind === "credit"),
);

export const SEVERITY_IDS = Object.freeze(["high", "full", "partial"]);
