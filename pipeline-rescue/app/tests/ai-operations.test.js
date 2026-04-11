const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRuntime } = require("../lib/pilot-runtime");
const { createAiOperationsCycle } = require("../lib/ai-operations");

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario-inputs.json"), "utf8")
);

function createTestRuntime() {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-ai-cycle-"));
  return createRuntime(fixtures, {
    stateFilePath: path.join(stateDir, "runtime-state.json")
  });
}

test("AI operations cycle stays review-only when automation is not allowed", () => {
  const runtime = createTestRuntime();
  const report = createAiOperationsCycle({
    runtime,
    scenarioId: "critical-stalled",
    policy: {
      autonomyMode: "ASSISTED",
      minimumRecommendationTrustScore: 85,
      minimumVerificationStabilityScore: 80,
      maxAutomatedDealsPerCycle: 2,
      correctionPassEnabled: true,
      memoryProtocol: "CYCLE_ISOLATED",
      hallucinationGuard: "STRICT",
      humanApprovalRequiredFor: ["CUSTOMER_DRAFTS", "TASK_WRITES"]
    },
    complianceReport: {
      status: "BLOCKED_FOR_DEPLOYMENT"
    }
  });

  assert.equal(report.cycleStatus, "BLOCKED");
  assert.equal(report.metrics.analyzedDeals, 2);
  assert.equal(report.metrics.tasksCreated, 0);
  assert.equal(report.decisions[0].taskDecision, "HUMAN_REVIEW_REQUIRED");
});

test("AI operations cycle executes tasks and drafts when policy is autonomous", () => {
  const runtime = createTestRuntime();
  const report = createAiOperationsCycle({
    runtime,
    scenarioId: "critical-stalled",
    policy: {
      autonomyMode: "SUPERVISED_AUTOPILOT",
      minimumRecommendationTrustScore: 0,
      minimumVerificationStabilityScore: 0,
      maxAutomatedDealsPerCycle: 1,
      correctionPassEnabled: true,
      memoryProtocol: "CYCLE_ISOLATED",
      hallucinationGuard: "STRICT",
      humanApprovalRequiredFor: []
    },
    complianceReport: {
      status: "READY_FOR_FORMAL_REVIEW"
    }
  });

  assert.equal(report.cycleStatus, "EXECUTED");
  assert.equal(report.metrics.selectedDeals, 1);
  assert.equal(report.metrics.tasksCreated, 1);
  assert.equal(report.metrics.draftsGenerated, 1);
  assert.equal(report.decisions[0].taskDecision, "CREATED");
  assert.equal(report.decisions[0].draftDecision, "GENERATED");
});
