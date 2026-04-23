const test = require("node:test");
const assert = require("node:assert/strict");

const { createPilotLaunchPlan } = require("../lib/pilot-launch-plan");

test("createPilotLaunchPlan blocks when mandatory technical gates fail", () => {
  const plan = createPilotLaunchPlan({
    systemReport: {
      readiness: false,
      summary: "System is degraded."
    },
    runtimeIntegrityReport: {
      status: "ERROR",
      failures: [{ label: "Runtime state", detail: "State file is corrupt." }],
      warnings: []
    },
    deploymentProfile: {
      checks: [
        {
          code: "access_control",
          label: "Access protection",
          status: "FAIL",
          detail: "Access control is disabled.",
          remediation: "Enable shared secret mode."
        },
        {
          code: "deployment_artifacts",
          label: "Deployment artifacts",
          status: "PASS",
          detail: "Artifacts are present.",
          remediation: "No action required."
        }
      ]
    }
  });

  assert.equal(plan.status, "BLOCKED_BY_TECHNICAL_GATES");
  assert.ok(plan.metrics.blockedCount >= 2);
  assert.equal(plan.nextAction.status, "BLOCKED");
  assert.ok(plan.actions.some((item) => item.code === "deployment_access_control"));
});

test("createPilotLaunchPlan reports signed-pilot readiness when technical gates pass", () => {
  const plan = createPilotLaunchPlan({
    systemReport: {
      readiness: true,
      summary: "System is ready."
    },
    runtimeIntegrityReport: {
      status: "READY"
    },
    deploymentProfile: {
      checks: [
        {
          code: "access_control",
          label: "Access protection",
          status: "PASS",
          detail: "Access control is enabled.",
          remediation: "No action required."
        },
        {
          code: "gdpr_gate",
          label: "GDPR deployment gate",
          status: "PASS",
          detail: "Compliance is ready for formal review.",
          remediation: "No action required."
        }
      ]
    }
  });

  assert.equal(plan.status, "READY_FOR_SIGNED_PILOT");
  assert.equal(plan.metrics.blockedCount, 0);
  assert.equal(plan.metrics.hardeningCount, 0);
  assert.equal(plan.metrics.manualGateCount, 4);
  assert.equal(plan.metrics.technicalReadinessPercent, 100);
  assert.equal(plan.nextAction.status, "MANUAL_REQUIRED");
});

test("createPilotLaunchPlan keeps hardening gaps below paid pilot readiness", () => {
  const plan = createPilotLaunchPlan({
    systemReport: {
      readiness: true,
      summary: "System is ready."
    },
    runtimeIntegrityReport: {
      status: "WARN",
      warnings: ["Runtime journal file is missing."]
    },
    deploymentProfile: {
      checks: [
        {
          code: "ai_provider",
          label: "AI provider readiness",
          status: "WARN",
          detail: "Provider is disabled.",
          remediation: "Configure provider before rollout."
        }
      ]
    }
  });

  assert.equal(plan.status, "READY_FOR_INTERNAL_DRY_RUN");
  assert.equal(plan.metrics.blockedCount, 0);
  assert.ok(plan.metrics.hardeningCount >= 1);
  assert.equal(plan.nextAction.status, "HARDEN");
});
