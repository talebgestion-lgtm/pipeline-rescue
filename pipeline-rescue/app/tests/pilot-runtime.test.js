const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createRuntime } = require("../lib/pilot-runtime");

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario-inputs.json"), "utf8")
);

test("analyzeDeal logs pilot events and returns analysis", () => {
  const runtime = createRuntime(fixtures);
  const payload = runtime.analyzeDeal("critical-stalled", "DL-1001");
  const events = runtime.getEvents("critical-stalled").events;

  assert.equal(payload.analysis.dealId, "DL-1001");
  assert.equal(events.length, 2);
  assert.equal(events[0].eventName, "deal_analysis_completed");
  assert.equal(events[1].eventName, "deal_analysis_requested");
});

test("createTask is idempotent after the first creation", () => {
  const runtime = createRuntime(fixtures);
  const first = runtime.createTask("critical-stalled", "DL-1001");
  const second = runtime.createTask("critical-stalled", "DL-1001");

  assert.equal(first.taskState.status, "CREATED");
  assert.equal(second.taskState.status, "ALREADY_EXISTS");
  assert.equal(runtime.getEvents("critical-stalled").events[0].eventName, "task_creation_skipped");
});

test("generateDraft logs a blocked event when the draft is unsafe", () => {
  const runtime = createRuntime(fixtures);
  const payload = runtime.generateDraft("draft-blocked", "DL-2001");
  const events = runtime.getEvents("draft-blocked").events;

  assert.equal(payload.draft.eligible, false);
  assert.equal(payload.draft.blockedReason, "PRIMARY_CONTACT_MISSING");
  assert.equal(events[0].eventName, "draft_blocked");
});

test("overview decorates queue items and focused deal with task state", () => {
  const runtime = createRuntime(fixtures);
  runtime.createTask("critical-stalled", "DL-1001");

  const overview = runtime.getOverview("critical-stalled");

  assert.equal(overview.focusedDeal.taskState.status, "CREATED");
  assert.equal(overview.queue[0].taskStatus, "CREATED");
});
