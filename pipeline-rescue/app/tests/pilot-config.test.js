const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDefaultPilotConfig,
  createPilotConfigReadiness,
  validatePilotConfigPayload
} = require("../lib/pilot-config");

test("validatePilotConfigPayload normalizes configurable pilot fields", () => {
  const config = validatePilotConfigPayload({
    provider: {
      legalName: "  Phoenix Software  ",
      country: "FR",
      supportEmail: "support@example.com"
    },
    customer: {
      name: "Example Customer",
      contactEmail: "buyer@example.com"
    },
    scope: {
      hubspotPortalId: "123",
      hubspotPipelineId: "sales",
      accessRoute: "private_app",
      pilotDurationDays: 999,
      maxUsers: 0
    },
    billing: {
      method: "invoice"
    },
    approvals: {
      pilotTermsReviewed: true
    }
  });

  assert.equal(config.provider.legalName, "Phoenix Software");
  assert.equal(config.scope.accessRoute, "PRIVATE_APP");
  assert.equal(config.scope.pilotDurationDays, 120);
  assert.equal(config.scope.maxUsers, 1);
  assert.equal(config.billing.method, "INVOICE");
  assert.equal(config.approvals.pilotTermsReviewed, true);
  assert.equal(config.approvals.privacyNoticeReviewed, false);
});

test("validatePilotConfigPayload rejects malformed emails", () => {
  assert.throws(
    () => validatePilotConfigPayload({
      provider: {
        supportEmail: "not-an-email"
      }
    }),
    /Provider support email is invalid/
  );
});

test("createPilotConfigReadiness reports missing commercial gates", () => {
  const readiness = createPilotConfigReadiness(createDefaultPilotConfig());

  assert.equal(readiness.status, "INCOMPLETE");
  assert.equal(readiness.metrics.completedGateCount, 0);
  assert.ok(readiness.gates.some((gate) => gate.code === "customer_scope" && gate.status === "MISSING"));
});

test("createPilotConfigReadiness passes when launch fields are complete", () => {
  const readiness = createPilotConfigReadiness({
    provider: {
      legalName: "Phoenix Software",
      country: "FR",
      supportEmail: "support@example.com"
    },
    customer: {
      name: "Example Customer",
      contactEmail: "buyer@example.com"
    },
    scope: {
      hubspotPortalId: "123",
      hubspotPipelineId: "sales",
      accessRoute: "PRIVATE_APP"
    },
    billing: {
      method: "INVOICE"
    },
    approvals: {
      pilotTermsReviewed: true,
      privacyNoticeReviewed: true,
      humanReviewAccepted: true,
      noSensitiveDataAccepted: true
    }
  });

  assert.equal(readiness.status, "READY");
  assert.equal(readiness.metrics.completedGateCount, 4);
});
