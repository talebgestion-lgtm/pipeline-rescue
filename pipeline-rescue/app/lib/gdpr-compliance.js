const ALLOWED_LAWFUL_BASES = new Set([
  "CONSENT",
  "CONTRACT",
  "LEGAL_OBLIGATION",
  "PUBLIC_TASK",
  "VITAL_INTERESTS",
  "LEGITIMATE_INTEREST"
]);

function buildCheck(code, label, status, evidence, remediation) {
  return {
    code,
    label,
    status,
    evidence,
    remediation
  };
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function resolveRoleChecks(roleModel, records) {
  const controllerRequired = roleModel === "CONTROLLER_ONLY" || roleModel === "PROCESSOR_AND_CONTROLLER";
  const processorRequired = roleModel === "PROCESSOR_ONLY" || roleModel === "PROCESSOR_AND_CONTROLLER";

  return {
    controllerRequired,
    processorRequired,
    controllerPass: !controllerRequired || Boolean(records.controllerRegisterMaintained),
    processorPass: !processorRequired || Boolean(records.processorRegisterMaintained)
  };
}

function createComplianceReport(config) {
  const controller = config.controller || {};
  const dpo = config.dpo || {};
  const records = config.records || {};
  const security = config.security || {};
  const transfers = config.transfers || {};
  const dataSubjectRights = config.dataSubjectRights || {};
  const breachResponse = config.breachResponse || {};
  const dpia = config.dpia || {};
  const processors = Array.isArray(config.processors) ? config.processors : [];
  const activities = Array.isArray(config.processingActivities) ? config.processingActivities : [];
  const roleModel = config.roleModel || "PROCESSOR_AND_CONTROLLER";

  const checks = [];

  checks.push(
    buildCheck(
      "controller_identity",
      "Controller identity documented",
      hasValue(controller.name) && hasValue(controller.contactEmail) && hasValue(controller.euEstablishmentCountry) ? "PASS" : "FAIL",
      hasValue(controller.name)
        ? `${controller.name} / ${controller.contactEmail || "missing contact"}`
        : "Controller identity is incomplete.",
      "Set controller legal name, privacy contact email, and EU establishment country."
    )
  );

  const roleChecks = resolveRoleChecks(roleModel, records);
  checks.push(
    buildCheck(
      "records_of_processing",
      "Records of processing maintained",
      roleChecks.controllerPass && roleChecks.processorPass ? "PASS" : "FAIL",
      `Role model: ${roleModel}. Controller register: ${Boolean(records.controllerRegisterMaintained)}. Processor register: ${Boolean(records.processorRegisterMaintained)}.`,
      "Maintain the Article 30 register(s) that match your role model and keep review dates current."
    )
  );

  const activitiesMissingBasis = activities.filter((activity) => !ALLOWED_LAWFUL_BASES.has(activity.lawfulBasis));
  const liaMissing = activities.filter(
    (activity) => activity.lawfulBasis === "LEGITIMATE_INTEREST" && !activity.legitimateInterestAssessmentCompleted
  );
  checks.push(
    buildCheck(
      "lawful_basis",
      "Lawful basis documented for every processing activity",
      activities.length > 0 && activitiesMissingBasis.length === 0 && liaMissing.length === 0 ? "PASS" : "FAIL",
      activitiesMissingBasis.length > 0
        ? `Missing/invalid lawful basis for: ${activitiesMissingBasis.map((activity) => activity.id).join(", ")}.`
        : liaMissing.length > 0
          ? `Legitimate-interest assessment missing for: ${liaMissing.map((activity) => activity.id).join(", ")}.`
          : `${activities.length} activity(ies) mapped to a lawful basis.`,
      "Assign one Article 6 basis per activity and complete the legitimate-interest assessment where legitimate interest is used."
    )
  );

  checks.push(
    buildCheck(
      "special_category_policy",
      "Special-category data prohibited for this product scope",
      config.specialCategoryData && config.specialCategoryData.allowed === false && config.specialCategoryData.guardEnabled === true
        ? "PASS"
        : "FAIL",
      config.specialCategoryData && config.specialCategoryData.allowed === false
        ? "Article 9 special-category data is blocked by product policy."
        : "Special-category data policy is not explicitly blocked.",
      "Set special-category data to forbidden and keep the product guard enabled."
    )
  );

  const automatedHighRisk = activities.filter(
    (activity) => activity.usesProfiling && (activity.producesLegalOrSimilarEffect || !activity.humanReviewRequired)
  );
  checks.push(
    buildCheck(
      "human_review",
      "No solely automated decision with legal or similarly significant effect",
      automatedHighRisk.length === 0 ? "PASS" : "FAIL",
      automatedHighRisk.length === 0
        ? "Profiling activities stay advisory and require human review."
        : `Unsafe automated-decision setup on: ${automatedHighRisk.map((activity) => activity.id).join(", ")}.`,
      "Keep profiling advisory-only, require human review, and do not enable Article 22-significant automated decisions."
    )
  );

  const processorFailures = processors.filter((processor) => processor.enabled !== false && !processor.dpaSigned);
  checks.push(
    buildCheck(
      "processor_contracts",
      "Processors contractually bound under Article 28",
      processorFailures.length === 0 ? "PASS" : "FAIL",
      processorFailures.length === 0
        ? `${processors.filter((processor) => processor.enabled !== false).length} active processor(s) reviewed.`
        : `Missing DPA for: ${processorFailures.map((processor) => processor.name).join(", ")}.`,
      "Sign a written DPA with every active processor and document subprocessor controls."
    )
  );

  const transferFail = transfers.usesThirdCountryTransfers
    && (!transfers.transferImpactAssessmentCompleted || !transfers.adequacyOrSafeguardDocumented);
  checks.push(
    buildCheck(
      "international_transfers",
      "Third-country transfers legally documented",
      transferFail ? "FAIL" : "PASS",
      transfers.usesThirdCountryTransfers
        ? `Transfers enabled. TIA completed: ${Boolean(transfers.transferImpactAssessmentCompleted)}. Safeguard documented: ${Boolean(transfers.adequacyOrSafeguardDocumented)}.`
        : "No third-country transfer declared.",
      "If data leaves the EEA, document adequacy or safeguards and complete a transfer-impact assessment."
    )
  );

  const securityPass = Boolean(
    security.encryptionAtRest
    && security.encryptionInTransit
    && security.rbac
    && security.mfa
    && security.auditLogs
    && security.backupRestoreTested
  );
  checks.push(
    buildCheck(
      "security_controls",
      "Security baseline implemented",
      securityPass ? "PASS" : "FAIL",
      `At rest: ${Boolean(security.encryptionAtRest)}, in transit: ${Boolean(security.encryptionInTransit)}, RBAC: ${Boolean(security.rbac)}, MFA: ${Boolean(security.mfa)}, audit logs: ${Boolean(security.auditLogs)}, restore tested: ${Boolean(security.backupRestoreTested)}.`,
      "Enable encryption, RBAC, MFA, audit logs, and tested backup/restore before production."
    )
  );

  const dsarPass = Boolean(
    hasValue(dataSubjectRights.requestChannelEmail)
    && dataSubjectRights.responseSlaDays <= 30
    && dataSubjectRights.identityVerificationProcedure
    && dataSubjectRights.erasureWorkflow
    && dataSubjectRights.portabilityWorkflow
    && dataSubjectRights.objectionWorkflow
  );
  checks.push(
    buildCheck(
      "data_subject_rights",
      "DSAR workflow operational",
      dsarPass ? "PASS" : "FAIL",
      hasValue(dataSubjectRights.requestChannelEmail)
        ? `DSAR channel ${dataSubjectRights.requestChannelEmail}, SLA ${dataSubjectRights.responseSlaDays} day(s).`
        : "No DSAR channel configured.",
      "Configure the DSAR contact channel, one-month SLA, identity verification, erasure, portability, and objection workflows."
    )
  );

  const breachPass = Boolean(
    hasValue(breachResponse.owner)
    && breachResponse.runbookLinked
    && breachResponse.supervisoryNotificationWindowHours <= 72
  );
  checks.push(
    buildCheck(
      "breach_response",
      "Breach response ready for the 72-hour rule",
      breachPass ? "PASS" : "FAIL",
      hasValue(breachResponse.owner)
        ? `Owner: ${breachResponse.owner}. Window: ${breachResponse.supervisoryNotificationWindowHours} hour(s).`
        : "Breach owner/runbook missing.",
      "Assign an incident owner, maintain a breach runbook, and enforce a supervisory-notification window of 72 hours or less."
    )
  );

  const dpiaPass = !dpia.required || Boolean(dpia.completed);
  checks.push(
    buildCheck(
      "dpia",
      "DPIA status consistent with risk level",
      dpiaPass ? "PASS" : "FAIL",
      dpia.required
        ? `DPIA required. Completed: ${Boolean(dpia.completed)}.`
        : "No DPIA currently marked as required.",
      "If the processing is high-risk, complete the DPIA before production."
    )
  );

  const dpoPass = !dpo.required || (Boolean(dpo.designated) && hasValue(dpo.contactEmail));
  checks.push(
    buildCheck(
      "dpo",
      "DPO status documented",
      dpoPass ? "PASS" : "FAIL",
      dpo.required
        ? `DPO required. Designated: ${Boolean(dpo.designated)}.`
        : `DPO not marked as required. Justification: ${dpo.justification || "missing"}.`,
      "Document whether a DPO is required. If yes, designate one with a reachable contact."
    )
  );

  const blockers = checks.filter((check) => check.status === "FAIL");
  const status = blockers.length > 0 ? "BLOCKED_FOR_DEPLOYMENT" : "READY_FOR_FORMAL_REVIEW";

  return {
    strictMode: Boolean(config.strictMode),
    status,
    roleModel,
    productName: config.productName || "Pipeline Rescue",
    blockers: blockers.map((check) => ({
      code: check.code,
      label: check.label,
      remediation: check.remediation
    })),
    checks,
    summary: blockers.length > 0
      ? `${blockers.length} mandatory GDPR control(s) are missing. Deployment must stay blocked.`
      : "Mandatory GDPR controls are documented. Formal legal review is still required before production.",
    assumptions: [
      "This report assumes Pipeline Rescue remains a B2B sales-assist tool and does not intentionally process Article 9 special-category data.",
      "This report is a product compliance gate, not a substitute for jurisdiction-specific legal advice."
    ]
  };
}

module.exports = {
  createComplianceReport
};
