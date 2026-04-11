const ALLOWED_AUTONOMY_MODES = new Set(["ADVISOR_ONLY", "ASSISTED", "SUPERVISED_AUTOPILOT"]);
const ALLOWED_MEMORY_PROTOCOLS = new Set(["CYCLE_ISOLATED", "SCENARIO_SCOPED"]);
const ALLOWED_HALLUCINATION_GUARDS = new Set(["STRICT", "STANDARD"]);
const ALLOWED_APPROVAL_TARGETS = new Set(["CUSTOMER_DRAFTS", "TASK_WRITES", "MANAGER_DIGESTS"]);

function invalidPolicy(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateAiPolicyPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidPolicy("AI policy body must be a JSON object.");
  }

  if (!ALLOWED_AUTONOMY_MODES.has(payload.autonomyMode)) {
    throw invalidPolicy("AI policy autonomyMode is invalid.");
  }

  if (!Number.isInteger(payload.minimumRecommendationTrustScore) || payload.minimumRecommendationTrustScore < 0 || payload.minimumRecommendationTrustScore > 100) {
    throw invalidPolicy("AI policy minimumRecommendationTrustScore must be an integer between 0 and 100.");
  }

  if (!Number.isInteger(payload.minimumVerificationStabilityScore) || payload.minimumVerificationStabilityScore < 0 || payload.minimumVerificationStabilityScore > 100) {
    throw invalidPolicy("AI policy minimumVerificationStabilityScore must be an integer between 0 and 100.");
  }

  if (!Number.isInteger(payload.maxAutomatedDealsPerCycle) || payload.maxAutomatedDealsPerCycle < 0) {
    throw invalidPolicy("AI policy maxAutomatedDealsPerCycle must be a non-negative integer.");
  }

  if (typeof payload.correctionPassEnabled !== "boolean") {
    throw invalidPolicy("AI policy correctionPassEnabled must be boolean.");
  }

  if (!ALLOWED_MEMORY_PROTOCOLS.has(payload.memoryProtocol)) {
    throw invalidPolicy("AI policy memoryProtocol is invalid.");
  }

  if (!ALLOWED_HALLUCINATION_GUARDS.has(payload.hallucinationGuard)) {
    throw invalidPolicy("AI policy hallucinationGuard is invalid.");
  }

  if (!Array.isArray(payload.humanApprovalRequiredFor)) {
    throw invalidPolicy("AI policy humanApprovalRequiredFor must be an array.");
  }

  for (const item of payload.humanApprovalRequiredFor) {
    if (!ALLOWED_APPROVAL_TARGETS.has(item)) {
      throw invalidPolicy("AI policy humanApprovalRequiredFor contains an invalid value.");
    }
  }

  return payload;
}

function buildCheck(status, label, detail) {
  return { status, label, detail };
}

function createAiControlReport({ policy, overview, feedbackReport, complianceReport }) {
  const verificationScore = overview?.verification?.stabilityScore ?? 0;
  const trustScore = feedbackReport?.metrics?.trustScore ?? 50;
  const complianceReady = complianceReport?.status !== "BLOCKED_FOR_DEPLOYMENT";
  const correctionReady = policy.correctionPassEnabled;
  const memoryReady = policy.memoryProtocol === "CYCLE_ISOLATED";
  const trustReady = trustScore >= policy.minimumRecommendationTrustScore;
  const verificationReady = verificationScore >= policy.minimumVerificationStabilityScore;
  const checks = [
    buildCheck(complianceReady ? "PASS" : "FAIL", "Compliance gate", complianceReady ? "Deployment is not blocked by GDPR strict mode." : "Deployment is blocked until the GDPR configuration is completed."),
    buildCheck(trustReady ? "PASS" : "WARN", "Operator trust threshold", `Current trust ${trustScore}/100, required ${policy.minimumRecommendationTrustScore}/100.`),
    buildCheck(verificationReady ? "PASS" : "WARN", "Verification stability threshold", `Current stability ${verificationScore}/100, required ${policy.minimumVerificationStabilityScore}/100.`),
    buildCheck(correctionReady ? "PASS" : "FAIL", "Correction pass", correctionReady ? "Correction pass is required before surfacing AI output." : "Correction pass is disabled."),
    buildCheck(memoryReady ? "PASS" : "WARN", "Memory protocol", memoryReady ? "Cycle-isolated memory is active." : "Memory is broader than the strict cycle-isolated baseline."),
    buildCheck(policy.hallucinationGuard === "STRICT" ? "PASS" : "WARN", "Hallucination guard", `Guard mode is ${policy.hallucinationGuard}.`)
  ];

  const blockers = [];
  if (!complianceReady) {
    blockers.push("GDPR deployment gate is still blocking release.");
  }
  if (!correctionReady) {
    blockers.push("Correction pass must remain enabled for AI output.");
  }
  if (!trustReady) {
    blockers.push("Operator trust score is below the configured autonomy threshold.");
  }
  if (!verificationReady) {
    blockers.push("Verification stability is below the configured autonomy threshold.");
  }

  let status = "ASSISTED";
  if (blockers.length > 0) {
    status = "GUARDED";
  }
  if (!complianceReady || !correctionReady) {
    status = "BLOCKED";
  }
  if (blockers.length === 0 && policy.humanApprovalRequiredFor.length === 0 && policy.autonomyMode === "SUPERVISED_AUTOPILOT") {
    status = "AUTONOMOUS_READY";
  }

  const draftAutomationAllowed = status === "AUTONOMOUS_READY" && !policy.humanApprovalRequiredFor.includes("CUSTOMER_DRAFTS");
  const taskAutomationAllowed = status === "AUTONOMOUS_READY" && !policy.humanApprovalRequiredFor.includes("TASK_WRITES");
  const digestAutomationAllowed = status !== "BLOCKED" && !policy.humanApprovalRequiredFor.includes("MANAGER_DIGESTS");

  return {
    status,
    summary:
      status === "BLOCKED" ? "AI operations are blocked until compliance and correction-pass requirements are satisfied." :
      status === "GUARDED" ? "AI remains in guarded mode: human review is still required before expanding automation." :
      status === "AUTONOMOUS_READY" ? "AI policy thresholds are satisfied for supervised automation." :
      "AI is configured for assisted operation with human review in the loop.",
    metrics: {
      autonomyMode: policy.autonomyMode,
      trustScore,
      trustThreshold: policy.minimumRecommendationTrustScore,
      verificationScore,
      verificationThreshold: policy.minimumVerificationStabilityScore,
      maxAutomatedDealsPerCycle: policy.maxAutomatedDealsPerCycle
    },
    checks,
    blockers,
    automationEnvelope: {
      draftAutomationAllowed,
      taskAutomationAllowed,
      digestAutomationAllowed
    },
    policySnapshot: {
      correctionPassEnabled: policy.correctionPassEnabled,
      memoryProtocol: policy.memoryProtocol,
      hallucinationGuard: policy.hallucinationGuard,
      humanApprovalRequiredFor: policy.humanApprovalRequiredFor
    }
  };
}

module.exports = {
  createAiControlReport,
  validateAiPolicyPayload
};
