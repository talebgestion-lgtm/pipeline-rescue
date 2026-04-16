const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createRuntimeSnapshot,
  listRuntimeSnapshots,
  loadRuntimeSnapshotBundle,
  validateSnapshotId
} = require("../lib/runtime-snapshots");

test("createRuntimeSnapshot stores a sanitized bundle and lists it", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-snapshots-"));

  try {
    const appPaths = {
      runtimeDir: tempDir,
      runtimeSnapshotsDir: path.join(tempDir, "snapshots"),
      runtimeStorageMode: "EXTERNAL_RUNTIME_DIR",
      bootstrapReportPath: path.join(tempDir, "bootstrap-report.json")
    };

    const snapshot = createRuntimeSnapshot({
      appPaths,
      packageManifest: { version: "0.27.0" },
      systemReport: { status: "DEGRADED" },
      runtimeBootstrapReport: { generatedAt: "2026-04-16T20:00:00.000Z" },
      runtimeExport: {
        stateFilePath: path.join(tempDir, "runtime-state.json"),
        scenarios: {
          "critical-stalled": {}
        }
      },
      gdprState: {
        complianceReport: { status: "BLOCKED_FOR_DEPLOYMENT" },
        gdprConfig: { strictMode: true }
      },
      aiPolicyState: {
        aiPolicy: { autonomyMode: "ADVISOR_ONLY" }
      },
      aiProviderState: {
        aiProviderConfig: { provider: "NONE" },
        aiProviderStatus: { status: "DISABLED" }
      },
      hubspotState: {
        hubspotConfig: { enabled: true },
        hubspotStatus: { status: "READY_FOR_INSTALL" },
        installState: {
          installs: [
            {
              portalId: "123",
              accessToken: "secret",
              refreshToken: "secret-refresh"
            }
          ]
        }
      },
      reason: "pre-upgrade"
    });

    assert.equal(fs.existsSync(snapshot.bundlePath), true);
    const listedSnapshots = listRuntimeSnapshots(appPaths);
    assert.equal(listedSnapshots.length, 1);
    assert.equal(listedSnapshots[0].snapshotId, snapshot.snapshotId);
    assert.equal(listedSnapshots[0].reason, "pre-upgrade");

    const loaded = loadRuntimeSnapshotBundle(appPaths, snapshot.snapshotId);
    assert.equal(loaded.bundle.bundleVersion, 1);
    assert.equal(loaded.bundle.hubspot.installState.installCount, 1);
    assert.equal("accessToken" in loaded.bundle.hubspot.installState.installs[0], false);
    assert.equal("refreshToken" in loaded.bundle.hubspot.installState.installs[0], false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validateSnapshotId rejects unsafe identifiers", () => {
  assert.throws(
    () => validateSnapshotId("../escape"),
    /Invalid runtime snapshot id/
  );
});
