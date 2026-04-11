const test = require("node:test");
const assert = require("node:assert/strict");
const { createAiControlReport, validateAiPolicyPayload } = require("../lib/ai-control");

test("AI control blocks when compliance is blocked", () => {
  const report = createAiControlReport({
    policy: {
      autonomyMode: "ASSISTED",
      minimumRecommendationTrustScore: 85,
      minimumVerificationStabilityScore: 80,
      maxAutomatedDealsPerCycle: 12,
      correctionPassEnabled: true,
      memoryProtocol: "CYCLE_ISOLATED",
      hallucinationGuard: "STRICT",
      humanApprovalRequiredFor: ["CUSTOMER_DRAFTS", "TASK_WRITES"]
    },
    overview: { verification: { stabilityScore: 96 } },
    feedbackReport: { metrics: { trustScore: 91 } },
    complianceReport: { status: "BLOCKED_FOR_DEPLOYMENT" }
  });

  assert.equal(report.status, "BLOCKED");
  assert.equal(report.automationEnvelope.draftAutomationAllowed, false);
});

test("AI policy validator rejects invalid thresholds", () => {
  assert.throws(
    () => validateAiPolicyPayload({
      autonomyMode: "ASSISTED",
      minimumRecommendationTrustScore: 140,
      minimumVerificationStabilityScore: 80,
      maxAutomatedDealsPerCycle: 12,
      correctionPassEnabled: true,
      memoryProtocol: "CYCLE_ISOLATED",
      hallucinationGuard: "STRICT",
      humanApprovalRequiredFor: []
    }),
    /minimumRecommendationTrustScore/
  );
});
