const test = require("node:test");
const assert = require("node:assert/strict");

const { createPilotLaunchPack } = require("../lib/pilot-launch-pack");

test("createPilotLaunchPack renders configured customer launch details", () => {
  const pack = createPilotLaunchPack({
    pilotConfigState: {
      pilotConfig: {
        provider: {
          legalName: "Phoenix Software",
          tradingName: "Pipeline Rescue",
          country: "FR",
          supportEmail: "support@example.com"
        },
        customer: {
          name: "Example Customer",
          contactEmail: "buyer@example.com",
          country: "FR"
        },
        scope: {
          hubspotPortalId: "123",
          hubspotPipelineId: "sales",
          accessRoute: "PRIVATE_APP",
          pilotStartDate: "2026-05-01",
          pilotDurationDays: 30,
          maxUsers: 5
        },
        billing: {
          method: "INVOICE",
          setupFeeEur: 500,
          pilotFeeEur: 299,
          continuationMonthlyFeeEur: 299,
          invoiceReference: "PR-001"
        },
        approvals: {
          pilotTermsReviewed: true,
          privacyNoticeReviewed: true,
          humanReviewAccepted: true,
          noSensitiveDataAccepted: true
        }
      },
      readiness: {
        gates: [
          {
            status: "DONE",
            label: "Provider identity",
            detail: "Provider identity is complete."
          }
        ]
      }
    },
    pilotLaunchPlan: {
      status: "READY_FOR_CUSTOMER_LAUNCH",
      summary: "Ready.",
      nextMilestone: "Start pilot.",
      metrics: {
        technicalReadinessPercent: 100,
        blockedCount: 0,
        hardeningCount: 0,
        manualGateCount: 0
      },
      actions: []
    },
    deploymentProfile: {
      checks: [
        {
          status: "PASS",
          label: "Access protection",
          detail: "Access control is enabled."
        }
      ]
    },
    systemReport: {
      readiness: true
    }
  });

  assert.equal(pack.status, "READY_FOR_CUSTOMER_LAUNCH");
  assert.match(pack.fileName, /^pipeline-rescue-pilot-launch-pack-/);
  assert.match(pack.markdown, /Phoenix Software/);
  assert.match(pack.markdown, /Example Customer/);
  assert.match(pack.markdown, /PRIVATE_APP/);
  assert.doesNotMatch(pack.markdown, /undefined/);
});

test("createPilotLaunchPack marks missing values as not configured", () => {
  const pack = createPilotLaunchPack({
    pilotConfigState: {},
    pilotLaunchPlan: {
      status: "READY_FOR_SIGNED_PILOT",
      metrics: {
        technicalReadinessPercent: 100,
        blockedCount: 0,
        hardeningCount: 0,
        manualGateCount: 4
      }
    },
    systemReport: {
      readiness: true
    }
  });

  assert.match(pack.markdown, /Not configured/);
  assert.match(pack.markdown, /No autonomous sending/);
});
