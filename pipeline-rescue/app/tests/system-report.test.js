const test = require("node:test");
const assert = require("node:assert/strict");

const { createSystemReport } = require("../lib/system-report");

test("system report is degraded when GDPR blocks deployment", () => {
  const report = createSystemReport({
    packageManifest: { version: "0.3.0" },
    fixtures: {
      defaultScenario: "critical-stalled",
      scenarios: { "critical-stalled": {} }
    },
    gdprState: {
      complianceReport: {
        status: "BLOCKED_FOR_DEPLOYMENT"
      },
      error: null
    },
    hubspotState: {
      hubspotStatus: {
        status: "READY_FOR_INSTALL"
      },
      error: null
    },
    runtimeDiagnostics: {
      stateFilePath: "runtime-state.json",
      stateLoadRecovered: false,
      lastPersistSucceeded: true
    },
    startupError: null
  });

  assert.equal(report.status, "DEGRADED");
  assert.equal(report.readiness, false);
  assert.ok(report.warnings.some((warning) => /GDPR strict mode/.test(warning)));
  assert.ok(report.warnings.some((warning) => /HubSpot live integration status/.test(warning)));
});

test("system report fails when bootstrap breaks", () => {
  const report = createSystemReport({
    packageManifest: { version: "0.3.0" },
    fixtures: null,
    gdprState: {
      complianceReport: null,
      error: "Missing gdpr config"
    },
    runtimeDiagnostics: null,
    startupError: "Scenario file missing"
  });

  assert.equal(report.status, "ERROR");
  assert.equal(report.readiness, false);
  assert.ok(report.failures.some((failure) => failure.code === "bootstrap"));
});

test("system report warns when external runtime storage has no bootstrap report", () => {
  const report = createSystemReport({
    packageManifest: { version: "0.23.0" },
    fixtures: {
      defaultScenario: "critical-stalled",
      scenarios: { "critical-stalled": {} }
    },
    gdprState: {
      complianceReport: {
        status: "READY_FOR_REVIEW"
      },
      error: null
    },
    hubspotState: {
      hubspotStatus: {
        status: "READY"
      },
      error: null
    },
    appPaths: {
      runtimeStorageMode: "EXTERNAL_RUNTIME_DIR",
      runtimeDir: "C:\\PipelineRescueData"
    },
    runtimeBootstrapReport: null,
    runtimeDiagnostics: {
      stateFilePath: "C:\\PipelineRescueData\\runtime-state.json",
      stateLoadRecovered: false,
      lastPersistSucceeded: true
    },
    startupError: null
  });

  assert.equal(report.status, "DEGRADED");
  assert.equal(report.runtime.storageMode, "EXTERNAL_RUNTIME_DIR");
  assert.equal(report.runtime.bootstrapReportPresent, false);
  assert.ok(report.warnings.some((warning) => /no bootstrap report/i.test(warning)));
  assert.ok(report.checks.some((check) => check.code === "runtime_layout" && check.status === "WARN"));
});

test("system report exposes runtime snapshot summary", () => {
  const report = createSystemReport({
    packageManifest: { version: "0.27.0" },
    fixtures: {
      defaultScenario: "critical-stalled",
      scenarios: { "critical-stalled": {} }
    },
    gdprState: {
      complianceReport: {
        status: "READY_FOR_REVIEW"
      },
      error: null
    },
    hubspotState: {
      hubspotStatus: {
        status: "READY"
      },
      error: null
    },
    appPaths: {
      runtimeStorageMode: "IN_PLACE",
      runtimeDir: "C:\\PipelineRescue\\data"
    },
    runtimeSnapshots: [
      {
        snapshotId: "snapshot-2026-04-16T20-00-00-000Z",
        createdAt: "2026-04-16T20:00:00.000Z"
      }
    ],
    runtimeBootstrapReport: {
      generatedAt: "2026-04-16T19:00:00.000Z"
    },
    runtimeDiagnostics: {
      stateFilePath: "C:\\PipelineRescue\\data\\runtime-state.json",
      stateLoadRecovered: false,
      lastPersistSucceeded: true
    },
    startupError: null
  });

  assert.equal(report.runtime.snapshotCount, 1);
  assert.equal(report.runtime.latestSnapshotId, "snapshot-2026-04-16T20-00-00-000Z");
  assert.equal(report.runtime.latestSnapshotAt, "2026-04-16T20:00:00.000Z");
});
