const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSupportBundle } = require("../lib/support-bundle");

test("buildSupportBundle includes runtime, system, and sanitized HubSpot state", () => {
  const bundle = buildSupportBundle({
    appPaths: {
      runtimeStorageMode: "EXTERNAL_RUNTIME_DIR",
      runtimeDir: "C:\\PipelineRescueData",
      bootstrapReportPath: "C:\\PipelineRescueData\\bootstrap-report.json"
    },
    packageManifest: {
      version: "0.24.0"
    },
    systemReport: {
      status: "DEGRADED"
    },
    runtimeBootstrapReport: {
      generatedAt: "2026-04-16T10:00:00Z"
    },
    runtimeExport: {
      stateFilePath: "C:\\PipelineRescueData\\runtime-state.json",
      scenarios: {
        "critical-stalled": {}
      }
    },
    gdprState: {
      complianceReport: { status: "BLOCKED_FOR_DEPLOYMENT" },
      gdprConfig: { strictMode: true },
      error: null
    },
    aiPolicyState: {
      aiPolicy: { autonomyMode: "ADVISOR_ONLY" },
      error: null
    },
    aiProviderState: {
      aiProviderConfig: { provider: "NONE" },
      aiProviderStatus: { status: "DISABLED" },
      error: null
    },
    hubspotState: {
      hubspotConfig: { enabled: true },
      hubspotStatus: { status: "READY_FOR_INSTALL" },
      installState: {
        installs: [
          {
            portalId: "123456",
            hubDomain: "demo.hubspot.com",
            connectedAt: "2026-04-16T09:00:00Z",
            expiresAt: "2026-04-16T10:00:00Z",
            scope: "oauth crm.objects.deals.read",
            accessToken: "secret_access",
            refreshToken: "secret_refresh"
          }
        ]
      },
      error: null
    }
  });

  assert.equal(bundle.product.version, "0.24.0");
  assert.equal(bundle.runtime.storageMode, "EXTERNAL_RUNTIME_DIR");
  assert.equal(bundle.runtime.exportState.stateFilePath, "C:\\PipelineRescueData\\runtime-state.json");
  assert.equal(bundle.hubspot.installState.installCount, 1);
  assert.equal(bundle.hubspot.installState.installs[0].portalId, "123456");
  assert.equal("accessToken" in bundle.hubspot.installState.installs[0], false);
  assert.equal("refreshToken" in bundle.hubspot.installState.installs[0], false);
});
