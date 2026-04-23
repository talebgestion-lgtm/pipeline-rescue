const test = require("node:test");
const assert = require("node:assert/strict");

const { createPilotDryRunAssistant } = require("../lib/pilot-dry-run");

test("createPilotDryRunAssistant blocks while core prerequisites are missing", () => {
  const assistant = createPilotDryRunAssistant({
    accessState: {
      status: {
        status: "DISABLED",
        summary: "Access control is disabled."
      }
    },
    gdprState: {
      complianceReport: {
        status: "BLOCKED_FOR_DEPLOYMENT",
        summary: "GDPR gate is blocked."
      }
    },
    hubspotState: {
      hubspotStatus: {
        status: "CONFIGURED_BLOCKED",
        summary: "HubSpot token is missing."
      }
    },
    pilotConfigState: {
      readiness: {
        status: "INCOMPLETE",
        gates: [
          {
            status: "MISSING",
            detail: "Provider identity is incomplete."
          }
        ]
      }
    }
  });

  assert.equal(assistant.status, "BLOCKED");
  assert.ok(assistant.metrics.blockedCount >= 3);
  assert.equal(assistant.nextStep.status, "BLOCKED");
});

test("createPilotDryRunAssistant points to the live preview when prerequisites are ready", () => {
  const assistant = createPilotDryRunAssistant({
    accessState: {
      status: {
        status: "PROTECTED",
        summary: "Access control is enabled."
      }
    },
    gdprState: {
      complianceReport: {
        status: "READY_FOR_FORMAL_REVIEW",
        summary: "GDPR gate is ready."
      }
    },
    hubspotState: {
      hubspotStatus: {
        status: "READY",
        summary: "HubSpot is ready."
      }
    },
    aiProviderState: {
      aiProviderStatus: {
        status: "DISABLED",
        summary: "AI provider is disabled."
      }
    },
    pilotConfigState: {
      readiness: {
        status: "READY",
        gates: [
          {
            status: "DONE",
            detail: "All commercial gates are complete."
          }
        ]
      }
    }
  });

  assert.equal(assistant.status, "READY_FOR_OPERATOR_DRY_RUN");
  assert.equal(assistant.nextStep.code, "live_preview");
  assert.equal(assistant.nextStep.status, "NEXT");
  assert.ok(assistant.steps.some((step) => step.code === "live_ai_provider" && step.status === "OPTIONAL"));
});
