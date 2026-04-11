const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createRuntime } = require("../lib/pilot-runtime");

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario-inputs.json"), "utf8")
);

function createTestRuntime() {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-runtime-"));
  return createRuntime(fixtures, {
    stateFilePath: path.join(stateDir, "runtime-state.json")
  });
}

test("analyzeDeal logs pilot events and returns analysis", () => {
  const runtime = createTestRuntime();
  const payload = runtime.analyzeDeal("critical-stalled", "DL-1001");
  const events = runtime.getEvents("critical-stalled").events;

  assert.equal(payload.analysis.dealId, "DL-1001");
  assert.equal(events.length, 2);
  assert.equal(events[0].eventName, "deal_analysis_completed");
  assert.equal(events[1].eventName, "deal_analysis_requested");
});

test("createTask is idempotent after the first creation", () => {
  const runtime = createTestRuntime();
  const first = runtime.createTask("critical-stalled", "DL-1001");
  const second = runtime.createTask("critical-stalled", "DL-1001");

  assert.equal(first.taskState.status, "CREATED");
  assert.equal(second.taskState.status, "ALREADY_EXISTS");
  assert.equal(runtime.getEvents("critical-stalled").events[0].eventName, "task_creation_skipped");
});

test("generateDraft logs a blocked event when the draft is unsafe", () => {
  const runtime = createTestRuntime();
  const payload = runtime.generateDraft("draft-blocked", "DL-2001");
  const events = runtime.getEvents("draft-blocked").events;

  assert.equal(payload.draft.eligible, false);
  assert.equal(payload.draft.blockedReason, "PRIMARY_CONTACT_MISSING");
  assert.equal(events[0].eventName, "draft_blocked");
});

test("overview decorates queue items and focused deal with task state", () => {
  const runtime = createTestRuntime();
  runtime.createTask("critical-stalled", "DL-1001");

  const overview = runtime.getOverview("critical-stalled");

  assert.equal(overview.focusedDeal.taskState.status, "CREATED");
  assert.equal(overview.queue[0].taskStatus, "CREATED");
});

test("runtime reloads persisted task and event state from disk", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-runtime-"));
  const stateFilePath = path.join(stateDir, "runtime-state.json");

  const runtimeA = createRuntime(fixtures, { stateFilePath });
  runtimeA.analyzeDeal("critical-stalled", "DL-1001");
  runtimeA.createTask("critical-stalled", "DL-1001");

  const runtimeB = createRuntime(fixtures, { stateFilePath });
  const overview = runtimeB.getOverview("critical-stalled");

  assert.equal(overview.focusedDeal.taskState.status, "CREATED");
  assert.ok(overview.pilotEvents.length >= 3);
});

test("resetScenario clears persisted local runtime state for that scenario", () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rescue-runtime-"));
  const stateFilePath = path.join(stateDir, "runtime-state.json");

  const runtime = createRuntime(fixtures, { stateFilePath });
  runtime.analyzeDeal("critical-stalled", "DL-1001");
  runtime.createTask("critical-stalled", "DL-1001");

  const resetOverview = runtime.resetScenario("critical-stalled");

  assert.equal(resetOverview.focusedDeal.taskState.status, "NOT_CREATED");
  assert.equal(resetOverview.pilotEvents.length, 0);
});

test("manager report summarizes coverage, reasons, and owner breakdown", () => {
  const runtime = createTestRuntime();
  runtime.analyzeDeal("critical-stalled", "DL-1001");
  runtime.createTask("critical-stalled", "DL-1001");
  runtime.generateDraft("critical-stalled", "DL-1001");

  const report = runtime.getManagerReport("critical-stalled");

  assert.equal(report.metrics.tasksCreated, 1);
  assert.equal(report.metrics.analysesRun, 1);
  assert.equal(report.metrics.draftsGenerated, 1);
  assert.ok(report.metrics.queueCoverageRate > 0);
  assert.equal(report.topReasons[0].reasonCode, "ACTIVITY_STALE");
  assert.equal(report.ownerBreakdown[0].owner, "Sarah Lane");
});
