const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildHubSpotDealSearchRequest,
  validateLiveSearchPayload
} = require("../lib/hubspot-live-search");

test("validateLiveSearchPayload normalizes optional fields and defaults", () => {
  const payload = validateLiveSearchPayload({
    portalId: " 123456 ",
    pipelineId: " default ",
    limit: "8",
    minimumLastActivityAgeDays: "14"
  });

  assert.deepEqual(payload, {
    portalId: "123456",
    pipelineId: "default",
    limit: 8,
    minimumLastActivityAgeDays: 14
  });
});

test("validateLiveSearchPayload rejects invalid ranges", () => {
  assert.throws(
    () => validateLiveSearchPayload({
      limit: 0,
      minimumLastActivityAgeDays: 7
    }),
    /between 1 and 25/
  );

  assert.throws(
    () => validateLiveSearchPayload({
      limit: 5,
      minimumLastActivityAgeDays: 366
    }),
    /between 0 and 365/
  );
});

test("buildHubSpotDealSearchRequest creates stale-deal filters for HubSpot search", () => {
  const request = buildHubSpotDealSearchRequest({
    pipelineId: "sales_pipeline",
    limit: 5,
    minimumLastActivityAgeDays: 7
  }, "2026-04-12T10:00:00Z");

  assert.equal(request.limit, 5);
  assert.equal(request.filterGroups.length, 1);
  assert.equal(request.filterGroups[0].filters[0].propertyName, "hs_lastactivitydate");
  assert.equal(request.filterGroups[0].filters[0].operator, "LT");
  assert.equal(request.filterGroups[0].filters[0].value, String(new Date("2026-04-05T10:00:00Z").getTime()));
  assert.equal(request.filterGroups[0].filters[1].propertyName, "hs_is_closed_won");
  assert.equal(request.filterGroups[0].filters[2].propertyName, "hs_is_closed_lost");
  assert.equal(request.filterGroups[0].filters[3].propertyName, "pipeline");
  assert.equal(request.filterGroups[0].filters[3].value, "sales_pipeline");
  assert.deepEqual(request.sorts, ["-hs_lastactivitydate"]);
});
