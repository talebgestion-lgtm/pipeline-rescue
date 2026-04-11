const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { buildOverview, buildDealAnalysis } = require("../lib/analysis-engine");

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "scenario-inputs.json"), "utf8")
);

test("critical-stalled produces a validated draftable focused deal", () => {
  const overview = buildOverview(fixtures, "critical-stalled");

  assert.equal(overview.focusedDeal.dealId, "DL-1001");
  assert.equal(overview.focusedDeal.rescueScore, 84);
  assert.equal(overview.focusedDeal.riskLevel, "CRITICAL");
  assert.equal(overview.verification.validationStatus, "VALIDATED");
  assert.equal(overview.focusedDeal.draft.eligible, true);
  assert.match(overview.focusedDeal.draft.body, /19 days/i);
});

test("draft-blocked scenario blocks customer-facing text when contact channel is not verified", () => {
  const overview = buildOverview(fixtures, "draft-blocked");

  assert.equal(overview.focusedDeal.dealId, "DL-2001");
  assert.equal(overview.focusedDeal.draft.eligible, false);
  assert.equal(overview.focusedDeal.draft.blockedReason, "PRIMARY_CONTACT_MISSING");
  assert.equal(overview.verification.validationStatus, "BLOCKED");
  assert.match(overview.verification.correctionsApplied[0], /contact email/i);
});

test("insufficient-data scenario refuses numeric certainty", () => {
  const analysis = buildDealAnalysis(fixtures, "insufficient-data", "DL-3001");

  assert.equal(analysis.analysis.eligibility, "INSUFFICIENT_DATA");
  assert.equal(analysis.analysis.rescueScore, null);
  assert.equal(analysis.verification.validationStatus, "UNVERIFIED");
  assert.deepEqual(analysis.verification.unverifiedFields, [
    "amount",
    "last_activity",
    "stage_age",
    "associated_contacts"
  ]);
});

test("healthy-monitored scenario stays calm and low priority", () => {
  const overview = buildOverview(fixtures, "healthy-monitored");

  assert.equal(overview.focusedDeal.riskLevel, "LOW");
  assert.equal(overview.focusedDeal.rescueScore, 0);
  assert.equal(overview.focusedDeal.recommendedAction.priority, "LOW");
  assert.match(overview.focusedDeal.recommendedAction.summary, /avoid unnecessary intervention|scheduled check-in/i);
});

test("out-of-scope deals are excluded from analyzed counts and queue", () => {
  const overview = buildOverview(fixtures, "insufficient-data");

  assert.equal(overview.summary.analyzedDeals, 2);
  assert.ok(!overview.queue.some((item) => item.dealId === "DL-3003"));
});

test("queue is sorted by rescue score descending", () => {
  const overview = buildOverview(fixtures, "critical-stalled");
  const queueDealIds = overview.queue.map((item) => item.dealId);

  assert.deepEqual(queueDealIds.slice(0, 3), ["DL-1001", "DL-1003", "DL-1002"]);
});
