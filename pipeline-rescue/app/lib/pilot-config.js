const ACCESS_ROUTES = new Set(["UNDECIDED", "PRIVATE_APP", "OAUTH"]);
const BILLING_METHODS = new Set(["UNDECIDED", "INVOICE", "PAYMENT_LINK", "BANK_TRANSFER"]);

function normalizeText(value, maxLength = 160) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
}

function normalizeInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = normalizeText(value, 40).toUpperCase();
  return allowedValues.has(normalized) ? normalized : fallback;
}

function normalizeBoolean(value) {
  return value === true;
}

function isValidEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createDefaultPilotConfig() {
  return {
    provider: {
      legalName: "",
      tradingName: "",
      country: "",
      supportEmail: ""
    },
    customer: {
      name: "",
      contactEmail: "",
      country: ""
    },
    scope: {
      hubspotPortalId: "",
      hubspotPipelineId: "",
      accessRoute: "UNDECIDED",
      pilotStartDate: "",
      pilotDurationDays: 30,
      maxUsers: 5
    },
    billing: {
      method: "UNDECIDED",
      setupFeeEur: 500,
      pilotFeeEur: 299,
      continuationMonthlyFeeEur: 299,
      invoiceReference: ""
    },
    approvals: {
      pilotTermsReviewed: false,
      privacyNoticeReviewed: false,
      humanReviewAccepted: false,
      noSensitiveDataAccepted: false
    }
  };
}

function validatePilotConfigPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("Pilot config body must be a JSON object.");
    error.statusCode = 400;
    throw error;
  }

  const provider = payload.provider && typeof payload.provider === "object" ? payload.provider : {};
  const customer = payload.customer && typeof payload.customer === "object" ? payload.customer : {};
  const scope = payload.scope && typeof payload.scope === "object" ? payload.scope : {};
  const billing = payload.billing && typeof payload.billing === "object" ? payload.billing : {};
  const approvals = payload.approvals && typeof payload.approvals === "object" ? payload.approvals : {};

  const config = {
    provider: {
      legalName: normalizeText(provider.legalName),
      tradingName: normalizeText(provider.tradingName),
      country: normalizeText(provider.country, 80),
      supportEmail: normalizeText(provider.supportEmail, 120)
    },
    customer: {
      name: normalizeText(customer.name),
      contactEmail: normalizeText(customer.contactEmail, 120),
      country: normalizeText(customer.country, 80)
    },
    scope: {
      hubspotPortalId: normalizeText(scope.hubspotPortalId, 80),
      hubspotPipelineId: normalizeText(scope.hubspotPipelineId, 120),
      accessRoute: normalizeEnum(scope.accessRoute, ACCESS_ROUTES, "UNDECIDED"),
      pilotStartDate: normalizeText(scope.pilotStartDate, 40),
      pilotDurationDays: normalizeInteger(scope.pilotDurationDays, 30, 1, 120),
      maxUsers: normalizeInteger(scope.maxUsers, 5, 1, 30)
    },
    billing: {
      method: normalizeEnum(billing.method, BILLING_METHODS, "UNDECIDED"),
      setupFeeEur: normalizeInteger(billing.setupFeeEur, 500, 0, 100000),
      pilotFeeEur: normalizeInteger(billing.pilotFeeEur, 299, 0, 100000),
      continuationMonthlyFeeEur: normalizeInteger(billing.continuationMonthlyFeeEur, 299, 0, 100000),
      invoiceReference: normalizeText(billing.invoiceReference, 120)
    },
    approvals: {
      pilotTermsReviewed: normalizeBoolean(approvals.pilotTermsReviewed),
      privacyNoticeReviewed: normalizeBoolean(approvals.privacyNoticeReviewed),
      humanReviewAccepted: normalizeBoolean(approvals.humanReviewAccepted),
      noSensitiveDataAccepted: normalizeBoolean(approvals.noSensitiveDataAccepted)
    }
  };

  if (!isValidEmail(config.provider.supportEmail)) {
    const error = new Error("Provider support email is invalid.");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(config.customer.contactEmail)) {
    const error = new Error("Customer contact email is invalid.");
    error.statusCode = 400;
    throw error;
  }

  return config;
}

function buildGate(code, label, done, missing, remediation) {
  return {
    code,
    label,
    status: done ? "DONE" : "MISSING",
    missing,
    detail: done
      ? `${label} is complete.`
      : `${label} is incomplete: ${missing.join(", ")}.`,
    remediation: done ? "No action required." : remediation
  };
}

function createPilotConfigReadiness(config) {
  const normalized = validatePilotConfigPayload(config || createDefaultPilotConfig());
  const gates = [];
  const providerMissing = [
    !normalized.provider.legalName ? "provider legal name" : null,
    !normalized.provider.country ? "provider country" : null,
    !normalized.provider.supportEmail ? "support email" : null
  ].filter(Boolean);
  const customerMissing = [
    !normalized.customer.name ? "customer name" : null,
    !normalized.customer.contactEmail ? "customer contact email" : null,
    !normalized.scope.hubspotPortalId ? "HubSpot portal ID" : null,
    !normalized.scope.hubspotPipelineId ? "HubSpot pipeline ID" : null,
    normalized.scope.accessRoute === "UNDECIDED" ? "HubSpot access route" : null
  ].filter(Boolean);
  const billingMissing = [
    normalized.billing.method === "UNDECIDED" ? "billing method" : null
  ].filter(Boolean);
  const approvalMissing = [
    !normalized.approvals.pilotTermsReviewed ? "pilot terms review" : null,
    !normalized.approvals.privacyNoticeReviewed ? "privacy notice review" : null,
    !normalized.approvals.humanReviewAccepted ? "human-review acceptance" : null,
    !normalized.approvals.noSensitiveDataAccepted ? "sensitive-data exclusion acceptance" : null
  ].filter(Boolean);

  gates.push(buildGate(
    "provider_identity",
    "Provider identity",
    providerMissing.length === 0,
    providerMissing,
    "Complete provider legal name, country, and support email."
  ));
  gates.push(buildGate(
    "customer_scope",
    "Customer pilot scope",
    customerMissing.length === 0,
    customerMissing,
    "Confirm customer identity, HubSpot portal, pipeline, and access route."
  ));
  gates.push(buildGate(
    "billing_method",
    "Billing method",
    billingMissing.length === 0,
    billingMissing,
    "Choose invoice, payment link, or bank transfer before sending the pilot offer."
  ));
  gates.push(buildGate(
    "signed_pilot_terms",
    "Signed pilot terms",
    approvalMissing.length === 0,
    approvalMissing,
    "Confirm terms, privacy notice, human review, and sensitive-data exclusions before launch."
  ));

  const completedGateCount = gates.filter((item) => item.status === "DONE").length;

  return {
    status: completedGateCount === gates.length ? "READY" : "INCOMPLETE",
    generatedAt: new Date().toISOString(),
    metrics: {
      completedGateCount,
      missingGateCount: gates.length - completedGateCount,
      totalGateCount: gates.length
    },
    gates
  };
}

module.exports = {
  createDefaultPilotConfig,
  createPilotConfigReadiness,
  validatePilotConfigPayload
};
