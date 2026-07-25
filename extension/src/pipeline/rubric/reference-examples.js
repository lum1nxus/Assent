export const CATEGORY_REFERENCES = {
  mandatory_arbitration: {
    definition:
      "The clause forces the user to resolve disputes through binding arbitration instead of going to court. A quote stating ONLY a venue or arbitration-rules body, without saying disputes MUST go to arbitration, is not enough on its own - the binding-arbitration commitment must be visible in the quote.",
    match: [
      "Any dispute shall be resolved by binding individual arbitration.",
      "You agree that all claims arising out of this Agreement will be resolved through final and binding arbitration.",
      "Either Party may initiate binding arbitration as the sole means to resolve Disputes, subject to the terms of this Agreement to Arbitrate.",
      "Disputes must be submitted to arbitration in accordance with the rules of the institution chosen by the service.",
    ],
    notMatch: [
      "You may, at your option, submit a dispute to arbitration or to the courts.",
      "Arbitration is available as one of several dispute resolution mechanisms.",
      "You may terminate this License at any time by canceling the agreement.",
      "We will attempt to resolve disputes informally before any formal proceeding.",
      "Arbitration will be held in a stated city.",
    ],
  },
  class_action_waiver: {
    definition:
      "The clause prevents the user from bringing or joining a class action, class arbitration, or representative proceeding. Phrasings like 'only on an individual basis', 'not as part of any class', 'not in a class, consolidated or representative action', 'class waiver' all qualify - they say the same thing as 'waiver of class rights'.",
    match: [
      "You waive any right to participate in a class action or class-wide arbitration.",
      "Each party waives any right to bring claims on a class or representative basis.",
      "Claims may only be brought in an individual capacity, not as part of any class.",
      "Any dispute will be conducted only on an individual basis and not in a class, consolidated or representative action.",
      "PLEASE NOTE: by accepting these terms you agree to a class action waiver.",
    ],
    notMatch: [
      "Disputes will be resolved between the parties.",
      "Each party retains the right to seek injunctive relief in court.",
      "The class action waiver in the preamble does not apply to this section.",
      "Either party may bring claims in small claims court.",
    ],
  },
  broad_content_license_irrevocable: {
    definition:
      "The USER grants the SERVICE a broad licence over content the user submits. ANY ONE of these traits is enough to qualify the licence as broad: perpetual, irrevocable, worldwide, sublicensable, transferable, royalty-free, or 'without further consent / notice / compensation'. The presence of the word 'non-exclusive' does NOT cancel the flag - 'non-exclusive' just means the user keeps a parallel right, it does not narrow the rights the service receives. A statement that the service or its licensors own the platform or its catalogue is service-side IP and is NOT a match.",
    match: [
      "By submitting content, you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use, modify, and sublicense it.",
      "You hereby grant the service a non-exclusive, transferable, sublicensable licence to your user-generated content.",
      "You grant us a non-exclusive license that is worldwide, transferable and sublicensable, to use, copy, modify, distribute, and process your content without any further consent, notice and/or compensation to you or others.",
      "You grant us a non-exclusive, perpetual, irrevocable, transferable license to use the feedback and ideas generated from the feedback without any restrictions, attribution, or compensation to you.",
      "By creating, posting or otherwise making content available on the Platform, you grant a licence to use your content which is non-exclusive, royalty-free, transferable, sub-licensable, and worldwide.",
      "We may freely use, distribute, and adapt the materials you upload, without compensation to you.",
    ],
    notMatch: [
      "We retain all intellectual property rights in our services.",
      "The service or its licensors are the sole owners of all rights to the platform or the content catalogue.",
      "All rights to the underlying software are reserved to the company.",
      "We respect your intellectual property and will respond to valid takedown notices.",
    ],
  },
  unilateral_terms_change_no_notice: {
    definition:
      "The clause lets the service change the agreement unilaterally without advance notice to the user. Advance notice, consent requirements, or notification of material changes are NOT a match.",
    match: [
      "We may modify these Terms at any time without prior notice.",
      "The service reserves the right to amend this agreement in its sole discretion at any time.",
      "Changes become effective immediately upon posting and you are responsible for reviewing the agreement.",
    ],
    notMatch: [
      "We will notify you of material changes at least 30 days in advance.",
      "Modifications require both parties' written agreement.",
      "With the consent of the customer, we may revise these terms.",
      "Material changes will be communicated by email before they take effect.",
    ],
  },
  data_resale_undisclosed_parties: {
    definition:
      "The clause allows the service to sell, rent, or trade personal data to undisclosed third parties or generic 'partners'. A clear no-sell statement or a narrowly named, purpose-bound sub-processor is NOT a match.",
    match: [
      "We may sell or share your personal information with third parties for marketing purposes.",
      "Personal data may be sold or rented to partners.",
      "We monetise user data through arrangements with advertising and analytics partners.",
    ],
    notMatch: [
      "We do not sell your personal data.",
      "We will not share your information with third parties for their own marketing.",
      "Payment data is shared only with our payment processor to charge your card.",
      "We share aggregated, anonymised statistics with research partners.",
    ],
  },
  broad_indemnity_from_user: {
    definition:
      "The clause requires the USER to indemnify, defend, or hold the service harmless against a broad class of third-party claims arising out of the user's use of the service.",
    match: [
      "You agree to indemnify, defend and hold us harmless from any claim arising out of your use of the service.",
      "You will indemnify the service against all losses, damages, and reasonable legal fees.",
      "The user shall hold the company harmless from any third-party claim related to user content.",
    ],
    notMatch: [
      "Our liability is limited to amounts paid in the prior twelve months.",
      "The service indemnifies the user against infringement claims.",
      "Nothing in this agreement limits liability for fraud or gross negligence.",
    ],
  },
  broad_limitation_of_liability: {
    definition:
      "The clause caps the service's liability at a token amount, excludes broad categories of damages (indirect, consequential, lost profits), or otherwise sharply limits what the user can recover.",
    match: [
      "Our aggregate liability is limited to the fees paid in the prior twelve months.",
      "In no event will the service be liable for indirect, incidental, or consequential damages.",
      "The service shall not be liable for any loss of data, profit, or business opportunity.",
    ],
    notMatch: [
      "You agree to indemnify us.",
      "Statutory rights are not affected by this clause.",
      "Liability for fraud or wilful misconduct is not limited.",
    ],
  },
  broad_warranty_disclaimer: {
    definition:
      "The clause broadly disclaims warranties about the service. Quotes that contain ALL-CAPS legal language asserting 'no representation or warranty', 'as is / as available', or disclaiming implied warranties (merchantability, fitness, non-infringement, accuracy) are matches - even if the surrounding context also says 'to the extent permitted by law'. Generic 'some jurisdictions may not allow' procedural disclaimers on their own are NOT a match.",
    match: [
      "THE SERVICE IS PROVIDED 'AS IS' WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.",
      "WE EXPRESSLY DISCLAIM ALL WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.",
      "WE MAKE NO REPRESENTATION OR WARRANTY ABOUT THE SERVICES, INCLUDING ANY REPRESENTATION THAT THE SERVICES WILL BE UNINTERRUPTED OR ERROR-FREE, AND PROVIDE THE SERVICES ON AN 'AS IS' AND 'AS AVAILABLE' BASIS.",
      "THE SERVICES ARE PROVIDED 'AS IS.' WE ALSO DISCLAIM ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, QUIET ENJOYMENT, AND NON-INFRINGEMENT.",
      "TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL IMPLIED WARRANTIES.",
    ],
    notMatch: [
      "SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES, SO THE ABOVE EXCLUSION MAY NOT APPLY TO YOU.",
      "We will provide commercially reasonable efforts to maintain the service.",
      "Service quality is guaranteed for paid subscriptions.",
    ],
  },
  broad_data_sharing_third_party: {
    definition:
      "The clause allows the service to share personal data with broad classes of third parties such as advertisers, affiliates, or unnamed partners. Opt-in language or narrowly named processors are NOT a match.",
    match: [
      "We may share your information with our advertising and analytics partners.",
      "Your data may be shared with affiliates for marketing purposes.",
      "We disclose user information to a broad network of partners to deliver personalised content.",
    ],
    notMatch: [
      "We do not share your data with third parties unless you explicitly opt in.",
      "Aggregate, anonymised statistics may be shared with research partners.",
      "Data is shared with payment processors solely to process transactions.",
      "We share information only with our parent company and only as required by law.",
    ],
  },
  account_termination_no_notice: {
    definition:
      "The clause gives the SERVICE the right to terminate, suspend, or disable the user's account at any time at its sole discretion, with no notice. A user-initiated cancellation is NOT a match - that is a credit, not a flag.",
    match: [
      "We may suspend or terminate your account at any time, at our sole discretion.",
      "The service reserves the right to deactivate accounts without notice.",
      "We may close your account for any reason or no reason at all.",
    ],
    notMatch: [
      "You may close your account at any time from settings.",
      "You may terminate this License at any time by canceling the agreement with us.",
      "We will provide written notice 30 days before any termination.",
      "Termination may occur for material breach of these Terms, with notice.",
    ],
  },
  content_removal_sole_discretion: {
    definition:
      "The clause lets the SERVICE remove or refuse to publish user content at its discretion, especially without notice. The phrase 'with or without notice' is a strong MATCH signal - the service taking action without notice is exactly the harm this category captures.",
    match: [
      "We may remove any content at our sole discretion.",
      "The service may take down content for any reason and without notice to the user.",
      "We are not obligated to publish any content on our Services and can remove it with or without notice.",
      "Content may be deleted at our discretion with no obligation to preserve copies.",
    ],
    notMatch: [
      "You may delete your own posts at any time.",
      "Content may be removed in accordance with our publicly stated community policy with a documented appeal path.",
      "Removal decisions can be appealed via the support portal.",
    ],
  },
  auto_renewal_no_clear_optout: {
    definition:
      "The clause states the subscription automatically renews and the user is bound until they actively cancel, without a clearly stated, friction-free cancellation path. Clear advance notice or an explicit no-auto-renewal statement are NOT a match.",
    match: [
      "Your subscription automatically renews until you cancel.",
      "Subscriptions renew on an annual basis automatically and you authorise the service to charge your card.",
      "We will continue to bill you on a recurring basis until you actively stop the subscription.",
    ],
    notMatch: [
      "Subscriptions do not auto-renew.",
      "Auto-renewal can be disabled at any time from settings.",
      "We will email you 14 days before any renewal so you can decide.",
    ],
  },
  retention_period_undefined: {
    definition:
      "The clause states personal data is retained for an undefined, open-ended, or vaguely-defined period ('as long as necessary', 'for the duration of the relationship').",
    match: [
      "We retain personal data as long as necessary for the service.",
      "Data is kept for the duration of the relationship between the user and the service.",
      "Personal data may be retained indefinitely for legitimate business interests.",
    ],
    notMatch: [
      "We retain billing data for 12 months and delete it thereafter.",
      "Personal data is deleted within 30 days of account closure.",
      "Account data is kept for the period required by law and then erased.",
    ],
  },
  governing_law_distant_venue: {
    definition:
      "A global service forces dispute resolution in a single named venue that is the service's home, regardless of where the user lives. Globally-active services pinning users to a single distant venue ARE a match. A neutral choice-of-law clause that leaves consumer venue rights intact, or a venue tied to the user's own residence, is NOT a match.",
    match: [
      "Any disputes shall be submitted to the exclusive jurisdiction of the courts of a country far from the user.",
      "Venue lies exclusively in a state where the user does not reside and where the service has chosen to incorporate.",
      "Disputes shall be heard exclusively in the courts of the service's home jurisdiction, regardless of where the user lives.",
      "All proceedings must be brought in the home court of the service, regardless of where the user is located.",
      "Each party consents to exclusive jurisdiction in the courts located in a named single city far from most users.",
    ],
    notMatch: [
      "Disputes will be resolved in the user's country of residence.",
      "Each party may bring claims in their local consumer court.",
      "Statutory consumer venue rights are preserved.",
      "If you are a consumer residing in the European Union, all Disputes shall be submitted to a court in your domicile.",
    ],
  },
  services_as_is: {
    definition:
      "The clause states the service is provided 'as is' or 'as available' but stops short of a full ALL-CAPS warranty disclaimer. If a full ALL-CAPS warranty disclaimer is present, prefer broad_warranty_disclaimer and treat services_as_is as NOT a match.",
    match: [
      "The service is provided on an 'as is' basis.",
      "We provide the platform as-is and as-available, without commitments to availability.",
      "Use of the service is at your own risk and is provided on an 'as available' basis.",
    ],
    notMatch: [
      "We will provide commercially reasonable efforts to maintain the service.",
      "Service quality is guaranteed for paid subscriptions.",
      "THE SERVICE IS PROVIDED 'AS IS' WITHOUT WARRANTY OF ANY KIND.",
    ],
  },
  other_unfavourable_clause: {
    definition:
      "Escape hatch - the clause is clearly adverse to the consumer but does not fit any other listed category. Use sparingly.",
    match: [
      "By signing up you agree to receive marketing communications and cannot opt out without closing your account.",
      "The service may modify the price at any time with immediate effect.",
      "You waive any right to a jury trial for any claim arising under these terms.",
      "You agree not to bring any claim later than one month after the event giving rise to it.",
    ],
    notMatch: [
      "Standard procedural clauses such as severability, force majeure, or third-party disclaimers.",
      "Generic statements about contacting customer support.",
      "A neutral statement of the parties to this agreement.",
      "Numbered section headings that carry no substantive rule of their own.",
    ],
  },
  explicit_refund_window: {
    definition:
      "The clause clearly states a refund window, typically expressed in days, during which the user can get their money back.",
    match: [
      "We offer a 30-day money-back guarantee on all paid plans.",
      "Refunds are available within 14 days of purchase for any reason.",
      "If you cancel within 7 days you will receive a full refund.",
    ],
    notMatch: [
      "All sales are final.",
      "Refunds are at our sole discretion.",
      "To meet the cancellation period it is sufficient for you to send notice before the period ends.",
      "Statutory withdrawal rights are not affected.",
    ],
  },
  easy_account_deletion: {
    definition:
      "The user can self-delete or self-close their account from within the service settings, with no friction. Service-initiated termination is NOT a match - that is a flag, not a credit.",
    match: [
      "You can delete your account at any time from Settings.",
      "Account deletion is available through self-service in your profile.",
      "Users may close their account from the account management screen at any moment.",
    ],
    notMatch: [
      "We may terminate or delete your account at any time at our sole discretion.",
      "To delete your account, contact support and allow up to 30 days for review.",
      "Account deletion requires verification by our trust and safety team.",
    ],
  },
  explicit_optin_data_sharing: {
    definition:
      "The clause requires explicit, prior opt-in consent from the user BEFORE personal data is shared with third parties. Deemed consent obtained merely by using the service is NOT a match.",
    match: [
      "We will share your data with third parties only with your explicit opt-in consent.",
      "Data sharing for marketing requires prior written consent from the user.",
      "Before any sharing of personal data with partners we will ask you to opt in.",
    ],
    notMatch: [
      "By using the service you consent to our processing of your personal data.",
      "You are deemed to consent to data sharing by registering an account.",
      "We may share data with partners; you can opt out by contacting support.",
    ],
  },
  no_automatic_renewal: {
    definition: "The service explicitly states that subscriptions do not auto-renew.",
    match: [
      "Subscriptions do not auto-renew.",
      "We do not automatically charge for renewal; you must actively renew to continue.",
      "There is no automatic billing at the end of your subscription period.",
    ],
    notMatch: [
      "Your subscription will automatically renew until you cancel.",
      "Renewal is automatic unless cancelled at least 7 days before the renewal date.",
      "Auto-renewal is enabled by default.",
    ],
  },
  transparent_retention_period: {
    definition:
      "The clause states a specific data-retention period with a clear endpoint after which the data is deleted.",
    match: [
      "Billing data is retained for 12 months and then deleted.",
      "Personal data is kept for 24 months from last activity and then erased.",
      "Logs are stored for 90 days and then purged.",
    ],
    notMatch: [
      "Data is retained as long as necessary for the service.",
      "Retention periods vary by data category.",
      "We may keep your data for legitimate business interests for an indefinite period.",
    ],
  },
  free_data_export: {
    definition:
      "The service offers export of user data in a portable format at no cost to the user.",
    match: [
      "You can export your data in a portable format at no cost from Settings.",
      "Data export is available free of charge in CSV and JSON formats.",
      "Users can download a copy of all their content at any time, no fee.",
    ],
    notMatch: [
      "Data export is available upon request and a fee may apply.",
      "Contact support for assistance with data export.",
      "Exports are limited to enterprise plans.",
    ],
  },
  arbitration_optout_window: {
    definition:
      "The user is given a stated window after sign-up during which they can opt out of an arbitration clause.",
    match: [
      "You may opt out of arbitration within 30 days of signing up by sending written notice.",
      "Users can decline the arbitration clause within 60 days of account creation.",
      "Arbitration opt-out is available during the first 45 days of service.",
    ],
    notMatch: [
      "Arbitration is mandatory.",
      "There is no opt-out available for the dispute resolution clause.",
      "The parties agree that any dispute will be resolved by arbitration.",
      "Arbitration proceedings will be conducted under the rules of a named arbitration body.",
    ],
  },
  user_retains_content_ownership: {
    definition:
      "The clause states that the USER retains ownership of content they submit or upload to the service. Service-side ownership of the service or its underlying content catalogue is NOT a match - that is service-side IP, not a user retention right.",
    match: [
      "You retain all rights to content you upload to the service.",
      "User submissions remain the property of the user.",
      "We do not claim ownership of your posts, photos, or other contributions.",
      "Users own the content they create and may delete it at any time.",
    ],
    notMatch: [
      "We are the sole owners of all rights to the service.",
      "The provider and its licensors are the sole owners of all rights to the service or the content.",
      "All rights to user-facing material are reserved to the company.",
      "The platform's licensors hold all rights in the underlying content catalogue.",
    ],
  },
};

export function referencesForCategory(category) {
  return CATEGORY_REFERENCES[category] ?? null;
}
