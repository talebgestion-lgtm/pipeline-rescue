const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createRuntime } = require("../lib/pilot-runtime");
const { inspectRuntimeIntegrity } = require("../lib/runtime-maintenance");

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario-inputs.json"), "utf8")
);

function createRuntimeHarness() {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-maintenance-"));
  const runtime = createRuntime(fixtures, {
    stateFilePath: path.join(runtimeDir, "runtime-state.json"),
    scenarioStoreDir: path.join(runtimeDir, "scenario-state"),
    journalFilePath: path.join(runtimeDir, "runtime-journal.jsonl")
  });

  return {
    runtimeDir,
    runtime,
    appPaths: {
      runtimeDir,
      runtimeStatePath: path.join(runtimeDir, "runtime-state.json"),
      runtimeScenarioStateDir: path.join(runtimeDir, "scenario-state"),
      runtimeJournalPath: path.join(runtimeDir, "runtime-journal.jsonl"),
      runtimeBackupsDir: path.join(runtimeDir, "backups"),
      runtimeLogsDir: path.join(runtimeDir, "logs")
    }
  };
}

test("inspectRuntimeIntegrity reports READY on a valid structured runtime", () => {
  const harness = createRuntimeHarness();
  harness.runtime.createTask("critical-stalled", "DL-1001");

  const report = inspectRuntimeIntegrity({
    appPaths: harness.appPaths,
    runtimeExport: harness.runtime.exportState(),
    runtimeSnapshots: []
  });

  assert.equal(report.status, "READY");
  assert.equal(report.metrics.runtimeScenarioShardCount, 1);
  assert.equal(report.metrics.journalEntries >= 1, true);
});

test("inspectRuntimeIntegrity warns when orphan shards are present", () => {
  const harness = createRuntimeHarness();
  harness.runtime.createTask("critical-stalled", "DL-1001");
  fs.writeFileSync(path.join(harness.appPaths.runtimeScenarioStateDir, "orphan.json"), JSON.stringify({
    scenarioId: "orphan",
    state: {}
  }));

  const report = inspectRuntimeIntegrity({
    appPaths: harness.appPaths,
    runtimeExport: harness.runtime.exportState(),
    runtimeSnapshots: []
  });

  assert.equal(report.status, "WARN");
  assert.equal(report.metrics.orphanScenarioShardCount, 1);
  assert.ok(report.warnings.some((warning) => /orphan scenario shard/i.test(warning)));
});

test("compactStorage rewrites the journal to a single current-state entry", () => {
  const harness = createRuntimeHarness();
  harness.runtime.analyzeDeal("critical-stalled", "DL-1001");
  harness.runtime.createTask("critical-stalled", "DL-1001");

  const compacted = harness.runtime.compactStorage();
  const journalLines = fs.readFileSync(harness.appPaths.runtimeJournalPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  const diagnostics = harness.runtime.getRuntimeDiagnostics();

  assert.equal(journalLines.length, 1);
  assert.equal(compacted.scenarioShardCount, 1);
  assert.equal(diagnostics.lastMaintenanceType, "COMPACT_RUNTIME_STORAGE");
  assert.match(diagnostics.lastMaintenanceAt, /^20\d{2}-/);
  assert.equal(harness.runtime.getOverview("critical-stalled").focusedDeal.taskState.status, "CREATED");
});
