const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildLiveQueueScenario,
  createLiveQueueManagerDigest,
  validateLiveQueueRequestPayload
} = require("../lib/hubspot-live-queue");

test("validateLiveQueueRequestPayload normalizes and deduplicates deal IDs", () => {
  const payload = validateLiveQueueRequestPayload({
    portalId: "123456",
    dealIds: "987,\n988,\n987"
  });

  assert.equal(payload.portalId, "123456");
  assert.deepEqual(payload.dealIds, ["987", "988"]);
});

test("validateLiveQueueRequestPayload rejects an empty request", () => {
  assert.throws(
    () => validateLiveQueueRequestPayload({ dealIds: "" }),
    /at least one deal ID/
  );
});

test("buildLiveQueueScenario aggregates previews into a deterministic scenario", () => {
  const scenario = buildLiveQueueScenario([
    {
      source: {
        portalId: "123456",
        hubDomain: "demo.hubspot.com"
      },
      normalizedDeal: {
        id: "987",
        name: "Acme Expansion"
      },
      normalizationWarnings: ["warning one"]
    },
    {
      source: {
        portalId: "123456",
        hubDomain: "demo.hubspot.com"
      },
      normalizedDeal: {
        id: "988",
        name: "Northwind Rollout"
      },
      normalizationWarnings: []
    }
  ], "2026-04-12T10:00:00Z");

  assert.equal(scenario.focusDealId, "987");
  assert.equal(scenario.deals.length, 2);
  assert.match(scenario.guardrailHint, /1 normalization warning/);
});

test("createLiveQueueManagerDigest summarizes the live queue for managers", () => {
  const digest = createLiveQueueManagerDigest({
    summary: {
      analyzedDeals: 3,
      atRiskDeals: 2,
      criticalDeals: 1,
      recoveredRevenueCandidate: 84000
    },
    queue: [
      {
        dealName: "Acme Expansion",
        riskLevel: "CRITICAL",
        nextBestAction: "Create a dated task."
      }
    ]
  }, [
    { normalizationWarnings: ["w1", "w2"] },
    { normalizationWarnings: [] }
  ]);

  assert.equal(digest.length, 4);
  assert.match(digest[0], /3 live deal/);
  assert.match(digest[2], /Acme Expansion/);
  assert.match(digest[3], /2 normalization warning/);
});
