const test = require("node:test");
const assert = require("node:assert/strict");

const { createSystemReport } = require("../lib/system-report");

test("system report is degraded when GDPR blocks deployment", () => {
  const report = createSystemReport({
    packageManifest: { version: "0.3.0" },
    accessState: {
      status: {
        mode: "DISABLED",
        status: "DISABLED",
        protectedRoutes: false,
        tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
        summary: "Access control is disabled for this instance."
      }
    },
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
      journalFilePath: "runtime-journal.jsonl",
      journalEntriesLoaded: 0,
      journalReplayUsed: false,
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
    accessState: {
      status: {
        mode: "SHARED_SECRET",
        status: "MISCONFIGURED",
        protectedRoutes: true,
        tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
        summary: "Access control is enabled but PIPELINE_RESCUE_ACCESS_TOKEN is missing from the environment."
      }
    },
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
  assert.ok(report.failures.some((failure) => failure.code === "access_control"));
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
    accessState: {
      status: {
        mode: "SHARED_SECRET",
        status: "PROTECTED",
        protectedRoutes: true,
        tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
        summary: "Access control is enabled."
      }
    },
    runtimeBootstrapReport: null,
    runtimeDiagnostics: {
      stateFilePath: "C:\\PipelineRescueData\\runtime-state.json",
      journalFilePath: "C:\\PipelineRescueData\\runtime-journal.jsonl",
      journalEntriesLoaded: 0,
      journalReplayUsed: false,
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
    accessState: {
      status: {
        mode: "SHARED_SECRET",
        status: "PROTECTED",
        protectedRoutes: true,
        tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
        summary: "Access control is enabled."
      }
    },
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
      runtimeDir: "C:\\PipelineRescue\\data",
      runtimeLockPath: "C:\\PipelineRescue\\data\\runtime.lock.json"
    },
    runtimeLock: {
      status: "ACQUIRED",
      lockPath: "C:\\PipelineRescue\\data\\runtime.lock.json",
      owner: {
        pid: 4242
      }
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
      journalFilePath: "C:\\PipelineRescue\\data\\runtime-journal.jsonl",
      journalEntriesLoaded: 4,
      journalReplayUsed: true,
      stateLoadRecovered: false,
      lastPersistSucceeded: true
    },
    startupError: null
  });

  assert.equal(report.runtime.snapshotCount, 1);
  assert.equal(report.runtime.latestSnapshotId, "snapshot-2026-04-16T20-00-00-000Z");
  assert.equal(report.runtime.latestSnapshotAt, "2026-04-16T20:00:00.000Z");
  assert.equal(report.runtime.runtimeJournalPath, "C:\\PipelineRescue\\data\\runtime-journal.jsonl");
  assert.equal(report.runtime.runtimeJournalEntriesLoaded, 4);
  assert.equal(report.runtime.runtimeJournalReplayUsed, true);
  assert.equal(report.runtime.runtimeLockStatus, "ACQUIRED");
  assert.equal(report.runtime.runtimeLockOwnerPid, 4242);
  assert.equal(report.access.mode, "SHARED_SECRET");
  assert.equal(report.access.status, "PROTECTED");
  assert.ok(report.warnings.some((warning) => /rebuilt from the append-only journal/i.test(warning)));
});

test("system report fails when runtime lock is blocked by another process", () => {
  const report = createSystemReport({
    packageManifest: { version: "0.28.0" },
    fixtures: null,
    gdprState: {
      complianceReport: null,
      error: null
    },
    hubspotState: {},
    accessState: {
      status: {
        mode: "SHARED_SECRET",
        status: "PROTECTED",
        protectedRoutes: true,
        tokenEnvVar: "PIPELINE_RESCUE_ACCESS_TOKEN",
        summary: "Access control is enabled."
      }
    },
    appPaths: {
      runtimeStorageMode: "EXTERNAL_RUNTIME_DIR",
      runtimeDir: "C:\\PipelineRescueData",
      runtimeLockPath: "C:\\PipelineRescueData\\runtime.lock.json"
    },
    runtimeLock: {
      status: "BLOCKED",
      lockPath: "C:\\PipelineRescueData\\runtime.lock.json",
      owner: {
        pid: 9999
      }
    },
    runtimeBootstrapReport: null,
    runtimeDiagnostics: null,
    startupError: "Runtime directory is already locked by process 9999."
  });

  assert.equal(report.status, "ERROR");
  assert.ok(report.failures.some((failure) => failure.code === "runtime_lock"));
});
